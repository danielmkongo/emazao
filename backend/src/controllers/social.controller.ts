import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Like from '../models/Like'
import Save from '../models/Save'
import Product from '../models/Product'
import Reel from '../models/Reel'
import { recordInteraction } from '../services/recommendation/signals'
import type { ContentType } from '../models/InteractionEvent'

// Resolve the creator of a liked/saved item so signals carry creator affinity
async function creatorOf(targetType: string, targetId: string): Promise<string | undefined> {
  if (targetType === 'Reel') return (await Reel.findById(targetId).select('userId'))?.userId?.toString()
  if (targetType === 'Product') return (await Product.findById(targetId).select('sellerId'))?.sellerId?.toString()
  return undefined
}

export const toggleLike = async (req: AuthRequest, res: Response) => {
  try {
    const { targetId, targetType } = req.body
    const userId = req.user!.id
    const existing = await Like.findOne({ userId, targetId, targetType })

    if (existing) {
      await existing.deleteOne()
      if (targetType === 'Product') await Product.findByIdAndUpdate(targetId, { $inc: { likeCount: -1 } })
      if (targetType === 'Reel') await Reel.findByIdAndUpdate(targetId, { $inc: { likeCount: -1 } })
      return res.json({ success: true, liked: false })
    }

    await Like.create({ userId, targetId, targetType })
    if (targetType === 'Product') await Product.findByIdAndUpdate(targetId, { $inc: { likeCount: 1 } })
    if (targetType === 'Reel') await Reel.findByIdAndUpdate(targetId, { $inc: { likeCount: 1 } })
    res.json({ success: true, liked: true })

    const creatorId = await creatorOf(targetType, targetId)
    void recordInteraction({ userId, contentId: targetId, contentType: targetType as ContentType, creatorId, event: 'like' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const toggleSave = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.body
    const userId = req.user!.id
    const existing = await Save.findOne({ userId, productId })

    if (existing) {
      await existing.deleteOne()
      await Product.findByIdAndUpdate(productId, { $inc: { saveCount: -1 } })
      return res.json({ success: true, saved: false })
    }

    await Save.create({ userId, productId })
    await Product.findByIdAndUpdate(productId, { $inc: { saveCount: 1 } })
    res.json({ success: true, saved: true })

    const creatorId = (await Product.findById(productId).select('sellerId'))?.sellerId?.toString()
    void recordInteraction({ userId, contentId: productId, contentType: 'PRODUCT', creatorId, event: 'save', source: 'marketplace' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getSaved = async (req: AuthRequest, res: Response) => {
  try {
    const saves = await Save.find({ userId: req.user!.id })
      .populate({ path: 'productId', populate: { path: 'sellerId', select: 'name username avatar' } })
      .sort({ createdAt: -1 })
      .limit(50)
    res.json({ success: true, data: saves.map((s: any) => s.productId) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
