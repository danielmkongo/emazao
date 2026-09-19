import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Like from '../models/Like'
import Save from '../models/Save'
import Product from '../models/Product'
import Reel from '../models/Reel'
import Comment from '../models/Comment'
import { recordInteraction } from '../services/recommendation/signals'
import type { ContentType } from '../models/InteractionEvent'

type Target = 'Product' | 'Reel'
const TARGETS: Target[] = ['Product', 'Reel']
// Comments can be liked but not saved, and carry no ranking signal.
type LikeTarget = Target | 'Comment'
const LIKE_TARGETS: LikeTarget[] = ['Product', 'Reel', 'Comment']
const PAGE = 24

// Resolve the creator of a liked/saved item so signals carry creator affinity
async function creatorOf(targetType: string, targetId: string): Promise<string | undefined> {
  if (targetType === 'Reel') return (await Reel.findById(targetId).select('userId'))?.userId?.toString()
  if (targetType === 'Product') return (await Product.findById(targetId).select('sellerId'))?.sellerId?.toString()
  return undefined
}

const counterModel = (t: LikeTarget) =>
  (t === 'Reel' ? Reel : t === 'Comment' ? Comment : Product) as unknown as mongoose.Model<any>

export const toggleLike = async (req: AuthRequest, res: Response) => {
  try {
    const { targetId, targetType } = req.body
    if (!LIKE_TARGETS.includes(targetType) || !mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid target' })
    }
    const userId = req.user!.id
    const existing = await Like.findOne({ userId, targetId, targetType })

    if (existing) {
      await existing.deleteOne()
      await counterModel(targetType).updateOne({ _id: targetId, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } })
      return res.json({ success: true, liked: false })
    }

    try {
      await Like.create({ userId, targetId, targetType })
    } catch (createErr: any) {
      // A near-simultaneous double-tap can race two toggles past the `existing`
      // check above; the unique index rejects the second insert — treat that as
      // an already-liked no-op instead of a 500.
      if (createErr.code === 11000) return res.json({ success: true, liked: true })
      throw createErr
    }
    await counterModel(targetType).updateOne({ _id: targetId }, { $inc: { likeCount: 1 } })
    res.json({ success: true, liked: true })

    // The signal store's content type is 'REEL' | 'PRODUCT'. This used to pass
    // 'Reel' / 'Product' straight through, which failed the enum on every call
    // inside a swallowed try — so likes never reached the ranking engine at all.
    if (targetType === 'Comment') return
    const creatorId = await creatorOf(targetType, targetId)
    void recordInteraction({ userId, contentId: targetId, contentType: targetType.toUpperCase() as ContentType, creatorId, event: 'like' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/social/save — bookmark a product or a reel.
 *
 * Accepts { targetId, targetType }. The older { productId } body is still
 * understood, so a client that has not updated yet keeps working.
 */
export const toggleSave = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as { targetId?: string; targetType?: Target; productId?: string }
    const targetType: Target = body.targetType ?? 'Product'
    const targetId = body.targetId ?? body.productId
    if (!TARGETS.includes(targetType) || !targetId || !mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid target' })
    }
    const userId = req.user!.id

    const exists = await counterModel(targetType).exists({ _id: targetId })
    if (!exists) return res.status(404).json({ success: false, message: `${targetType} not found` })

    const existing = await Save.findOne({ userId, targetType, targetId })
    if (existing) {
      await existing.deleteOne()
      // Guarded decrement: a counter that drifted below zero would show "-1 saves".
      await counterModel(targetType).updateOne({ _id: targetId, saveCount: { $gt: 0 } }, { $inc: { saveCount: -1 } })
      return res.json({ success: true, saved: false })
    }

    try {
      await Save.create({
        userId, targetType, targetId,
        ...(targetType === 'Product' ? { productId: targetId } : {}),
      })
    } catch (e: any) {
      if (e.code === 11000) return res.json({ success: true, saved: true })
      throw e
    }
    await counterModel(targetType).updateOne({ _id: targetId }, { $inc: { saveCount: 1 } })
    res.json({ success: true, saved: true })

    const creatorId = await creatorOf(targetType, targetId)
    void recordInteraction({
      userId, contentId: targetId, contentType: targetType.toUpperCase() as ContentType,
      creatorId, event: 'save', source: targetType === 'Reel' ? 'reels' : 'marketplace',
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * Hydrate a page of saves or likes into the items themselves, newest first,
 * dropping anything since deleted or taken down — a grid tile for a removed reel
 * would open to a 404.
 */
async function hydrate(type: Target, rows: { targetId: any; createdAt: Date }[]) {
  const ids = rows.map(r => r.targetId)
  const docs = type === 'Reel'
    ? await Reel.find({ _id: { $in: ids }, status: 'PUBLISHED' })
        .populate('userId', 'name username avatar isVerified')
        .populate('productId', 'title price priceUnit images slug')
        .lean()
    : await Product.find({ _id: { $in: ids }, status: { $ne: 'INACTIVE' } })
        .populate('sellerId', 'name username avatar isVerified')
        .lean()
  const byId = new Map(docs.map((d: any) => [String(d._id), d]))
  return rows.map(r => byId.get(String(r.targetId))).filter(Boolean)
}

function pageArgs(req: AuthRequest) {
  const type = (String(req.query['type'] ?? 'Reel') === 'Product' ? 'Product' : 'Reel') as Target
  const cursor = req.query['cursor'] ? new Date(String(req.query['cursor'])) : null
  return { type, cursor: cursor && !isNaN(cursor.getTime()) ? cursor : null }
}

/**
 * GET /api/social/saved?type=Reel|Product&cursor= — your own saves only.
 * Private, as on Instagram: nobody else can see what you have bookmarked.
 */
export const getSaved = async (req: AuthRequest, res: Response) => {
  try {
    const { type, cursor } = pageArgs(req)
    const filter: Record<string, unknown> = { userId: req.user!.id, targetType: type }
    if (cursor) filter['createdAt'] = { $lt: cursor }

    const rows = await Save.find(filter).sort({ createdAt: -1 }).limit(PAGE).select('targetId createdAt').lean()
    const items = await hydrate(type, rows)
    const nextCursor = rows.length === PAGE ? rows[rows.length - 1]!.createdAt.toISOString() : null
    res.json({ success: true, data: items, nextCursor })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/social/liked?type=Reel|Product&cursor= — your own likes only.
 * Private by default, as TikTok's Liked tab is.
 */
export const getLiked = async (req: AuthRequest, res: Response) => {
  try {
    const { type, cursor } = pageArgs(req)
    const filter: Record<string, unknown> = { userId: req.user!.id, targetType: type }
    if (cursor) filter['createdAt'] = { $lt: cursor }

    const rows = await Like.find(filter).sort({ createdAt: -1 }).limit(PAGE).select('targetId createdAt').lean()
    const items = await hydrate(type, rows)
    const nextCursor = rows.length === PAGE ? rows[rows.length - 1]!.createdAt.toISOString() : null
    res.json({ success: true, data: items, nextCursor })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
