import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Reel from '../models/Reel'
import Comment from '../models/Comment'
import { v2 as cloudinary } from 'cloudinary'

export const getReels = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = 10
    const reels = await Reel.find({ status: 'PUBLISHED' })
      .populate('userId', 'name username avatar isVerified')
      .populate('productId', 'title price priceUnit images')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
    res.json({ success: true, data: reels, page })
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
    const { watchTime = 0 } = req.body
    await Reel.findByIdAndUpdate(req.params.id, {
      $inc: { viewCount: 1, totalWatchTime: watchTime },
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const comments = await Comment.find({ reelId: req.params.id as any })
      .populate('userId', 'name username avatar isVerified')
      .sort({ createdAt: -1 })
      .limit(50)
    res.json({ success: true, data: comments })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const postComment = async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content required' })
    const comment = await Comment.create({
      userId: req.user!.id,
      reelId: req.params.id as any,
      content: content.trim(),
    })
    await Reel.findByIdAndUpdate(req.params.id, { $inc: { commentCount: 1 } })
    await comment.populate('userId', 'name username avatar isVerified')
    res.status(201).json({ success: true, data: comment })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const incrementShareCount = async (req: AuthRequest, res: Response) => {
  try {
    await Reel.findByIdAndUpdate(req.params.id, { $inc: { shareCount: 1 } })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
