import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Conversation from '../models/Conversation'
import Message from '../models/Message'
import User from '../models/User'
import { sendNotification, emitToRoom } from '../services/notification.service'

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'name username avatar isVerified')
      .sort({ lastMessageAt: -1 })
      .limit(50)

    const unreadCounts = await Message.aggregate([
      { $match: { conversationId: { $in: conversations.map(c => c._id) }, senderId: { $ne: new mongoose.Types.ObjectId(userId) }, readAt: null } },
      { $group: { _id: '$conversationId', count: { $sum: 1 } } },
    ])
    const unreadByConvo = new Map(unreadCounts.map(u => [u._id.toString(), u.count]))

    const data = conversations.map(c => ({
      ...c.toObject(),
      unreadCount: unreadByConvo.get(c._id.toString()) ?? 0,
    }))

    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// GET /api/messages/unread-count — total unread messages across all of the
// user's conversations, for the nav badge (doesn't require fetching the whole
// conversation list).
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const conversationIds = await Conversation.find({ participants: userId }).select('_id').lean()
    const count = await Message.countDocuments({
      conversationId: { $in: conversationIds.map(c => c._id) },
      senderId: { $ne: userId },
      readAt: null,
    })
    res.json({ success: true, data: { count } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params
    const conversation = await Conversation.findById(conversationId)
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' })
    if (!conversation.participants.map(String).includes(req.user!.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const messages = await Message.find({ conversationId })
      .populate('senderId', 'name username avatar')
      .sort({ createdAt: 1 })
      .limit(100)
    res.json({ success: true, data: messages })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { recipientId, content, mediaUrl, conversationId: existingConvId } = req.body
    const senderId = req.user!.id

    let conversation
    if (existingConvId) {
      conversation = await Conversation.findById(existingConvId)
    } else {
      conversation = await Conversation.findOne({ participants: { $all: [senderId, recipientId] }, type: 'DIRECT' })
      if (!conversation) {
        conversation = await Conversation.create({ participants: [senderId, recipientId], type: 'DIRECT' })
      }
    }

    if (!conversation) return res.status(400).json({ success: false, message: 'Cannot create conversation' })

    const message = await Message.create({ conversationId: conversation._id, senderId, content, mediaUrl })
    conversation.lastMessage = content
    conversation.lastMessageAt = new Date()
    await conversation.save()

    await message.populate('senderId', 'name username avatar')

    emitToRoom(`conv:${conversation._id}`, 'message:new', message)

    const notifyRecipientId = conversation.participants.map(String).find(id => id !== senderId)
    if (notifyRecipientId) {
      const sender = await User.findById(senderId).select('name')
      await sendNotification({
        userId: notifyRecipientId,
        type: 'MESSAGE',
        title: 'New message',
        body: `${sender?.name ?? 'Someone'}: ${content.slice(0, 80)}${content.length > 80 ? '…' : ''}`,
        link: `/messages/${conversation._id}`,
      })
    }

    res.status(201).json({ success: true, data: { message, conversationId: conversation._id } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const markRead = async (req: AuthRequest, res: Response) => {
  try {
    await Message.updateMany(
      { conversationId: req.params.conversationId, senderId: { $ne: req.user!.id }, readAt: null },
      { readAt: new Date() },
    )
    // Live read-receipt update — without this the sender's read tick only
    // flips after their next refetch, not when the recipient actually reads it.
    emitToRoom(`conv:${req.params.conversationId}`, 'message:read', {
      conversationId: req.params.conversationId,
      readerId: req.user!.id,
      readAt: new Date(),
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
