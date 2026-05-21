import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Like from '../models/Like'
import Save from '../models/Save'
import Product from '../models/Product'
import Reel from '../models/Reel'

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
