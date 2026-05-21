import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Conversation from '../models/Conversation'
import Message from '../models/Message'

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await Conversation.find({ participants: req.user!.id })
      .populate('participants', 'name username avatar isVerified')
      .sort({ lastMessageAt: -1 })
      .limit(50)
    res.json({ success: true, data: conversations })
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
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
