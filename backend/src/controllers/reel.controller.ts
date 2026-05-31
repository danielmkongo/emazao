import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Reel from '../models/Reel'
import Comment from '../models/Comment'
import Like from '../models/Like'
import { initContentStats, recordInteraction } from '../services/recommendation/signals'

export const getReels = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = 10
    const reels = await Reel.find({ status: 'PUBLISHED' })
      .populate('userId', 'name username avatar isVerified')
      .populate('productId', 'title price priceUnit images slug')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    let likedSet = new Set<string>()
    if (req.user?.id) {
      const likes = await Like.find({
        userId: req.user.id,
        targetId: { $in: reels.map(r => r._id) },
        targetType: 'Reel',
      })
      likedSet = new Set(likes.map(l => l.targetId.toString()))
    }

    const data = reels.map(r => ({
      ...r.toObject(),
      userLiked: likedSet.has(r._id.toString()),
    }))

    res.json({ success: true, data, page })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getUserReels = async (req: AuthRequest, res: Response) => {
  try {
    const reels = await Reel.find({ userId: req.params.userId, status: 'PUBLISHED' })
      .sort({ createdAt: -1 })
      .limit(30)
    res.json({ success: true, data: reels })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const createReel = async (req: AuthRequest, res: Response) => {
  try {
    const { title, caption, videoUrl, thumbnailUrl, duration, tags, productId } = req.body
    const reel = await Reel.create({
      userId: req.user!.id,
      title,
      caption,
      videoUrl,
      thumbnailUrl,
      duration,
      tags: tags || [],
      productId: productId || undefined,
      status: 'PUBLISHED',
    })
    await reel.populate('userId', 'name username avatar isVerified')

    // Register the reel with the recommendation engine at TEST stage (cold start)
    void initContentStats({
      contentId: reel.id,
      contentType: 'REEL',
      creatorId: req.user!.id,
      topics: reel.tags ?? [],
      contentCreatedAt: reel.createdAt,
    })

    res.status(201).json({ success: true, data: reel })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const deleteReel = async (req: AuthRequest, res: Response) => {
  try {
    const reel = await Reel.findById(req.params.id)
    if (!reel) return res.status(404).json({ success: false, message: 'Reel not found' })
    if (reel.userId.toString() !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    await reel.deleteOne()
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const recordReelView = async (req: AuthRequest, res: Response) => {
  try {
    const { watchTime = 0 } = req.body  // seconds spent on this reel
    const reel = await Reel.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewCount: 1, totalWatchTime: watchTime } }
    ).select('userId duration')
    res.json({ success: true })

    // Feed watch signals into the recommendation engine (fire-and-forget).
    // NOTE: once the client emits granular events to /api/events, drop this block.
    const userId = req.user?.id
    if (reel && userId) {
      const creatorId = reel.userId.toString()
      const id = String(req.params.id)
      const dur = reel.duration || 0
      const pct = dur > 0 ? Math.min(1, watchTime / dur) : undefined
      void recordInteraction({ userId, contentId: id, contentType: 'REEL', creatorId, event: 'view_start', source: 'reels' })
      if (pct !== undefined) {
        void recordInteraction({ userId, contentId: id, contentType: 'REEL', creatorId, event: 'watch', watchMs: watchTime * 1000, pctWatched: pct, source: 'reels' })
        if (pct >= 0.9) void recordInteraction({ userId, contentId: id, contentType: 'REEL', creatorId, event: 'complete', source: 'reels' })
      }
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const comments = await Comment.find({ reelId: req.params.id })
      .populate('userId', 'name username avatar isVerified')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    res.json({ success: true, data: comments })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const postComment = async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content required' })
    const created = await Comment.create({
      userId: req.user!.id,
      reelId: req.params.id as any,
      content: content.trim(),
    })
    await Reel.findByIdAndUpdate(req.params.id, { $inc: { commentCount: 1 } })
    // Fetch with populate rather than calling .populate() on the instance (more reliable in Mongoose 8)
    const comment = await Comment.findById(created.id)
      .populate('userId', 'name username avatar isVerified')
      .lean()
    res.status(201).json({ success: true, data: comment })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const incrementShareCount = async (req: AuthRequest, res: Response) => {
  try {
    const reel = await Reel.findByIdAndUpdate(req.params.id, { $inc: { shareCount: 1 } }).select('userId')
    res.json({ success: true })

    const userId = req.user?.id
    if (reel && userId) {
      void recordInteraction({ userId, contentId: String(req.params.id), contentType: 'REEL', creatorId: reel.userId.toString(), event: 'share', source: 'reels' })
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
