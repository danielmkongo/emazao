import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Notification from '../models/Notification'

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = 20
    const notifications = await Notification.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
    const unreadCount = await Notification.countDocuments({ userId: req.user!.id, isRead: false })
    res.json({ success: true, data: notifications, unreadCount, page })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const markAllRead = async (req: AuthRequest, res: Response) => {
  try {
    await Notification.updateMany({ userId: req.user!.id, isRead: false }, { isRead: true })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const markOneRead = async (req: AuthRequest, res: Response) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user!.id }, { isRead: true })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
