import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Conversation from '../models/Conversation'
import Message from '../models/Message'
import User from '../models/User'
import Notification from '../models/Notification'
import Reel from '../models/Reel'
import Product from '../models/Product'
import { sendNotification, emitToRoom } from '../services/notification.service'
import { isUserOnline } from '../socket'

/**
 * How long a sender has to take a message back or fix a typo.
 *
 * Long enough to catch the wrong recipient or a wrong price, short enough
 * that it cannot be used to quietly rewrite a negotiation the other side has
 * already read and acted on.
 */
export const EDIT_WINDOW_MS = 60_000

/** When this person last cleared the conversation, if they ever did. */
function clearedAt(conversation: any, userId: string): Date | undefined {
  const row = (conversation?.clears ?? []).find((c: any) => String(c.userId) === String(userId))
  return row?.at
}

/**
 * What a participant is allowed to see of a message.
 *
 * A recalled message keeps its text in the database for dispute review, so it
 * has to be stripped here rather than at rest: content, media and anything
 * attached all go, and the client is told only that it was recalled and when.
 * Edit history never leaves the server at all.
 */
function forParticipant(message: any) {
  const m = typeof message?.toObject === 'function' ? message.toObject() : { ...message }
  delete m.editHistory
  if (m.replyTo && typeof m.replyTo === 'object') m.replyTo = forParticipant(m.replyTo)
  if (!m.recalledAt) return m
  return {
    _id: m._id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: '',
    recalledAt: m.recalledAt,
    createdAt: m.createdAt,
    deliveredAt: m.deliveredAt,
    readAt: m.readAt,
    clientId: m.clientId,
  }
}

/** The one line the inbox shows for a message. */
function previewOf(m: any): string {
  if (!m) return ''
  if (m.recalledAt) return 'Message recalled'
  if (m.content) return m.content
  if (m.storyReply) return m.storyReply.reaction ? 'Reacted to a story' : 'Replied to a story'
  if (m.sharedReel) return 'Shared a reel'
  if (m.sharedProduct) return 'Asked about a product'
  if (m.mediaUrl) return 'Sent a photo'
  return ''
}

/** Re-derive a conversation's inbox line from whatever is now last in it. */
async function refreshPreview(conversation: any) {
  const last = await Message.findOne({ conversationId: conversation._id }).sort({ createdAt: -1 })
  conversation.lastMessage = previewOf(last)
  if (last?.createdAt) conversation.lastMessageAt = last.createdAt
  await conversation.save()
}

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    // $size 2 excludes malformed rows written before recipients were validated:
    // a [sender, null] conversation has no counterpart to show, so it rendered as
    // a thread with no name and no avatar that could never deliver a message.
    // Hiding them here keeps existing inboxes clean without a migration.
    const conversations = await Conversation.find({ participants: userId, 'participants.1': { $exists: true } })
      .populate('participants', 'name username avatar isVerified')
      .sort({ lastMessageAt: -1 })
      .limit(50)

    const unreadCounts = await Message.aggregate([
      { $match: { conversationId: { $in: conversations.map(c => c._id) }, senderId: { $ne: new mongoose.Types.ObjectId(userId) }, readAt: null } },
      { $group: { _id: '$conversationId', count: { $sum: 1 } } },
    ])
    const unreadByConvo = new Map(unreadCounts.map(u => [u._id.toString(), u.count]))

    const data = conversations
      // A cleared conversation stays gone until something new is said in it.
      .filter(c => {
        const cleared = clearedAt(c, userId)
        return !cleared || (c.lastMessageAt ? c.lastMessageAt > cleared : false)
      })
      .map(c => {
        const o = c.toObject() as any
        delete o.clears // one person's deletions are not the other's business
        return { ...o, unreadCount: unreadByConvo.get(c._id.toString()) ?? 0 }
      })

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
    const conversations = await Conversation.find({ participants: userId }).select('_id clears').lean()
    // Messages hidden by "delete chat" cannot be opened, so counting them
    // would leave a badge the user has no way to clear.
    const count = await Message.countDocuments({
      senderId: { $ne: userId },
      readAt: null,
      $or: conversations.map(c => {
        const cleared = clearedAt(c, userId)
        return cleared
          ? { conversationId: c._id, createdAt: { $gt: cleared } }
          : { conversationId: c._id }
      }).slice(0, 500),
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

    // Opening the thread is proof of arrival for anything that was sent while
    // this user was offline — the socket receipt only covers messages that
    // landed while they were connected. Done before the read so the response
    // already carries the new state and the sender's ticks settle in one round
    // trip rather than two.
    await Message.updateMany(
      { conversationId, senderId: { $ne: req.user!.id }, deliveredAt: null },
      { deliveredAt: new Date() }
    )

    const cleared = clearedAt(conversation, req.user!.id)
    const messages = await Message.find({
      conversationId,
      ...(cleared ? { createdAt: { $gt: cleared } } : {}),
    })
      .populate('senderId', 'name username avatar')
      .populate(SHARED_REEL_POPULATE)
      .populate(SHARED_PRODUCT_POPULATE)
      .populate(REPLY_TO_POPULATE)
      // Newest first, then turned back round. Sorting oldest-first before the
      // limit returned the first 100 messages ever sent, so a conversation
      // past that length stopped showing anything new when it was reopened.
      .sort({ createdAt: -1 })
      .limit(100)
    res.json({ success: true, data: messages.reverse().map(forParticipant) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { recipientId, content, mediaUrl, conversationId: existingConvId, productId, replyTo } = req.body
    const senderId = req.user!.id

    // A question asked from a listing carries that listing, so the seller sees
    // which of their products is being asked about instead of "is this still
    // available?" with no subject.
    let sharedProduct: string | undefined
    if (productId) {
      if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({ success: false, message: 'Invalid product' })
      }
      const product = await Product.findById(productId).select('_id')
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' })
      sharedProduct = String(product._id)
    }

    // The schema no longer requires text, because a shared reel can travel with
    // no note. An ordinary message still needs something in it.
    if (!String(content ?? '').trim() && !mediaUrl && !sharedProduct) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' })
    }

    let conversation
    if (existingConvId) {
      conversation = await Conversation.findById(existingConvId)
      // Membership check — an id alone used to be enough to post into any
      // conversation on the platform, so a guessed/leaked conversationId let a
      // stranger inject messages into someone else's buyer↔seller negotiation
      // (and trigger a notification that looked like it came from that thread).
      if (conversation && !conversation.participants.map(String).includes(senderId)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
    } else {
      // Validate the recipient before creating anything. Without this an absent
      // recipientId — the client sends null, because URLSearchParams.get()
      // returns null for a missing query param — was cast straight into the
      // participants array, producing a conversation of [sender, null]. It
      // looked like a real thread to the sender: it appeared in their inbox with
      // their message in it, showed "User" and a blank avatar because there was
      // no counterpart to resolve, and could never be delivered to anyone.
      if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
        return res.status(400).json({ success: false, message: 'A valid recipient is required' })
      }
      if (String(recipientId) === String(senderId)) {
        return res.status(400).json({ success: false, message: 'You cannot message yourself' })
      }
      const recipient = await User.findById(recipientId).select('_id')
      if (!recipient) {
        return res.status(404).json({ success: false, message: 'Recipient not found' })
      }

      conversation = await Conversation.findOne({ participants: { $all: [senderId, recipientId] }, type: 'DIRECT' })
      if (!conversation) {
        conversation = await Conversation.create({ participants: [senderId, recipientId], type: 'DIRECT' })
      }
    }

    if (!conversation) return res.status(400).json({ success: false, message: 'Cannot create conversation' })

    // A reply has to point at a message in this same conversation — otherwise
    // a quoted line from somewhere else could be pulled into view here.
    let replyToId: string | undefined
    if (replyTo) {
      if (!mongoose.isValidObjectId(replyTo)) {
        return res.status(400).json({ success: false, message: 'Invalid message' })
      }
      const original = await Message.findOne({ _id: replyTo, conversationId: conversation._id }).select('_id recalledAt')
      if (!original) return res.status(404).json({ success: false, message: 'Message not found' })
      if (original.recalledAt) {
        return res.status(400).json({ success: false, message: 'That message was recalled' })
      }
      replyToId = String(original._id)
    }

    const clientId = typeof req.body?.clientId === 'string' && /^[\w-]{1,64}$/.test(req.body.clientId) ? req.body.clientId : undefined
    const message = await deliverMessage(conversation, senderId, { content: String(content ?? '').trim(), mediaUrl, clientId, sharedProduct, replyTo: replyToId })
    res.status(201).json({ success: true, data: { message: forParticipant(message), conversationId: conversation._id } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const markRead = async (req: AuthRequest, res: Response) => {
  try {
    // Same membership check as getMessages — otherwise any authenticated user
    // could flip read receipts on a conversation they aren't part of.
    const conversation = await Conversation.findById(req.params.conversationId)
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' })
    if (!conversation.participants.map(String).includes(req.user!.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    await Message.updateMany(
      { conversationId: req.params.conversationId, senderId: { $ne: req.user!.id }, readAt: null },
      { readAt: new Date() },
    )
    // Reading the chat is reading its "new message" notifications too. They
    // used to stay unread, so the bell kept counting messages you had already
    // opened and read.
    await Notification.updateMany(
      { userId: req.user!.id, type: 'MESSAGE', link: `/messages/${req.params.conversationId}`, isRead: { $ne: true } },
      { isRead: true, readAt: new Date() },
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

/** How a shared reel is embedded wherever a message is sent back to a client. */
const SHARED_REEL_POPULATE = {
  path: 'sharedReel',
  select: 'thumbnailUrl videoUrl caption title status viewCount userId',
  populate: { path: 'userId', select: 'name username avatar isVerified' },
}

/**
 * What a quoted message carries: enough words to recognise it, and when it was
 * a reel, a listing or a story, just enough of that to draw a thumbnail beside
 * the quote. Never the full media — a reply is a pointer, not a copy.
 */
const REPLY_TO_POPULATE = {
  path: 'replyTo',
  select: 'content senderId recalledAt mediaUrl sharedReel sharedProduct storyReply',
  populate: [
    { path: 'senderId', select: 'name username' },
    { path: 'sharedReel', select: 'thumbnailUrl videoUrl caption' },
    { path: 'sharedProduct', select: 'title images' },
  ],
}

/** How an attached listing is embedded wherever a message is sent to a client. */
const SHARED_PRODUCT_POPULATE = {
  path: 'sharedProduct',
  select: 'title slug images price priceUnit status availableStock stockUnit',
}

/**
 * Store a message in a conversation and tell everyone who needs to know.
 * Shared by ordinary sends and reel shares so the two cannot drift apart on
 * delivery receipts, inbox ordering, socket push or notifications.
 */
export async function deliverMessage(
  conversation: any,
  senderId: string,
  fields: { content: string; mediaUrl?: string; sharedReel?: string; sharedProduct?: string; storyReply?: Record<string, unknown>; clientId?: string; replyTo?: string },
) {
  // If the recipient is connected, the push below reaches their device
  // immediately — so record delivery now rather than waiting for them to open
  // the thread, which would mark it read in the same moment and make
  // "delivered" a state the sender could never actually observe.
  const deliverToId = conversation.participants.map(String).find((pid: string) => pid !== senderId)
  const deliveredAt = deliverToId && isUserOnline(deliverToId) ? new Date() : undefined

  const message = await Message.create({ conversationId: conversation._id, senderId, ...fields, deliveredAt })

  // The inbox preview needs words even when the message is only a reel.
  const reaction = fields.storyReply?.reaction as string | undefined
  const preview = fields.content
    ? (fields.storyReply ? `Replied to your story: ${fields.content}` : fields.content)
    : fields.storyReply ? `Reacted ${reaction ?? ''} to your story`.replace('  ', ' ')
    : fields.sharedReel ? 'Shared a reel'
    : fields.sharedProduct ? 'Asked about a product'
    : fields.mediaUrl ? 'Sent a photo' : ''
  conversation.lastMessage = preview
  conversation.lastMessageAt = new Date()
  await conversation.save()

  await message.populate('senderId', 'name username avatar')
  if (fields.sharedReel) await message.populate(SHARED_REEL_POPULATE)
  if (fields.sharedProduct) await message.populate(SHARED_PRODUCT_POPULATE)
  if (fields.replyTo) await message.populate(REPLY_TO_POPULATE)

  emitToRoom(`conv:${conversation._id}`, 'message:new', forParticipant(message))

  if (deliverToId) {
    const sender = await User.findById(senderId).select('name')
    await sendNotification({
      userId: deliverToId,
      type: 'MESSAGE',
      title: fields.storyReply ? `${sender?.name ?? 'Someone'} replied to your story`
        : fields.sharedReel ? `${sender?.name ?? 'Someone'} sent you a reel`
        : fields.sharedProduct ? `${sender?.name ?? 'Someone'} asked about your listing` : 'New message',
      body: `${sender?.name ?? 'Someone'}: ${preview.slice(0, 80)}${preview.length > 80 ? '…' : ''}`,
      link: `/messages/${conversation._id}`,
    })
  }
  return message
}

/**
 * Take back the bare reaction a viewer left on one story, so re-reacting
 * replaces it rather than stacking. Only reactions with no words of their own
 * are retractable — a written reply is a message, and messages are not unsent.
 * Also rewinds the inbox preview when the retracted line was the last one.
 */
export async function retractStoryReaction(conversation: any, senderId: string, storyId: string) {
  const gone = await Message.findOneAndDelete({
    conversationId: conversation._id,
    senderId,
    'storyReply.storyId': storyId,
    'storyReply.reaction': { $exists: true, $ne: null },
    content: '',
  })
  if (!gone) return
  emitToRoom(`conv:${conversation._id}`, 'message:removed', { messageId: String(gone._id), conversationId: String(conversation._id) })
  // Only the bell entry raised for this exact message — it is written
  // immediately after it, so a tight window around its timestamp cannot catch
  // an unrelated unread message in the same thread.
  await Notification.deleteMany({
    type: 'MESSAGE',
    link: `/messages/${conversation._id}`,
    isRead: { $ne: true },
    createdAt: { $gte: gone.createdAt, $lte: new Date(+gone.createdAt + 5000) },
  })
  const last = await Message.findOne({ conversationId: conversation._id }).sort({ createdAt: -1 })
  conversation.lastMessage = last
    ? (last.content || (last.get('storyReply')?.reaction ? 'Reacted to a story' : last.get('sharedReel') ? 'Shared a reel' : last.get('sharedProduct') ? 'Asked about a product' : 'Sent a photo'))
    : ''
  conversation.lastMessageAt = last?.createdAt ?? conversation.lastMessageAt
  await conversation.save()
}

/**
 * POST /api/messages/message/:id/recall — unsend, within the edit window.
 *
 * Amazon's model rather than a silent deletion: the other person is told a
 * message was recalled instead of watching a line vanish from a conversation
 * they may have already read. Nothing is destroyed — see the Message model.
 */
export const recallMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid message' })
    const message = await Message.findById(req.params.id)
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' })
    if (String(message.senderId) !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'You can only recall your own messages' })
    }
    if (message.recalledAt) return res.json({ success: true, data: { alreadyRecalled: true } })
    if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
      return res.status(400).json({ success: false, message: 'Too late to recall this message' })
    }

    message.recalledAt = new Date()
    await message.save()

    const conversation = await Conversation.findById(message.conversationId)
    if (conversation) await refreshPreview(conversation)

    emitToRoom(`conv:${message.conversationId}`, 'message:recalled', {
      messageId: String(message._id),
      conversationId: String(message.conversationId),
      recalledAt: message.recalledAt,
    })
    // The bell should not still be offering a message that no longer exists.
    await Notification.deleteMany({
      type: 'MESSAGE',
      link: `/messages/${message.conversationId}`,
      isRead: { $ne: true },
      createdAt: { $gte: message.createdAt, $lte: new Date(+new Date(message.createdAt) + 5000) },
    })
    res.json({ success: true, data: { recalledAt: message.recalledAt } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** PATCH /api/messages/message/:id — fix a typo, within the edit window. */
export const editMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid message' })
    const content = String(req.body?.content ?? '').trim()
    if (!content) return res.status(400).json({ success: false, message: 'Message cannot be empty' })
    if (content.length > 5000) return res.status(400).json({ success: false, message: 'Message is too long' })

    const message = await Message.findById(req.params.id)
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' })
    if (String(message.senderId) !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' })
    }
    if (message.recalledAt) return res.status(400).json({ success: false, message: 'That message was recalled' })
    // Only words can be edited. Swapping the photo or the listing under a
    // message the other side has already read is a different thing entirely.
    if (!message.content) return res.status(400).json({ success: false, message: 'This message cannot be edited' })
    if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
      return res.status(400).json({ success: false, message: 'Too late to edit this message' })
    }
    if (content === message.content) return res.json({ success: true, data: forParticipant(message) })

    message.editHistory = [...(message.editHistory ?? []), { content: message.content, at: new Date() }]
    message.content = content
    message.editedAt = new Date()
    await message.save()

    const conversation = await Conversation.findById(message.conversationId)
    if (conversation) await refreshPreview(conversation)

    emitToRoom(`conv:${message.conversationId}`, 'message:edited', {
      messageId: String(message._id),
      conversationId: String(message.conversationId),
      content,
      editedAt: message.editedAt,
    })
    res.json({ success: true, data: forParticipant(message) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * DELETE /api/messages/:conversationId — clear this conversation for me.
 *
 * One-sided and reversible in the sense that matters: the other person keeps
 * their copy, an admin reviewing a dispute keeps all of it, and a new message
 * starts the thread again from empty.
 */
export const clearConversation = async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId)
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' })
    if (!conversation.participants.map(String).includes(req.user!.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    const userId = new mongoose.Types.ObjectId(req.user!.id)
    const at = new Date()
    const existing = (conversation.clears ?? []).find(c => String(c.userId) === req.user!.id)
    if (existing) existing.at = at
    else conversation.clears = [...(conversation.clears ?? []), { userId, at }]
    await conversation.save()

    // Whatever was unread in there is unread no longer — it is not reachable.
    await Message.updateMany(
      { conversationId: conversation._id, senderId: { $ne: req.user!.id }, readAt: null },
      { readAt: at },
    )
    await Notification.updateMany(
      { userId: req.user!.id, type: 'MESSAGE', link: `/messages/${conversation._id}`, isRead: { $ne: true } },
      { isRead: true, readAt: at },
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** Find the one-to-one conversation between two people, creating it if needed. */
export async function directConversation(a: string, b: string) {
  return (await Conversation.findOne({ participants: { $all: [a, b] }, type: 'DIRECT' }))
    ?? Conversation.create({ participants: [a, b], type: 'DIRECT' })
}

const MAX_SHARE_RECIPIENTS = 20

/**
 * POST /api/messages/share-reel — send a reel to one or more people.
 *
 * Instagram's "send to": each recipient gets it in their own direct chat with
 * you, never a group thread they did not ask to be in. Capped per request so the
 * share sheet cannot be turned into a way to spam a reel across the platform.
 */
export const shareReel = async (req: AuthRequest, res: Response) => {
  try {
    const { reelId, recipientIds, note } = req.body as { reelId?: string; recipientIds?: string[]; note?: string }
    const senderId = req.user!.id

    if (!reelId || !mongoose.isValidObjectId(reelId)) {
      return res.status(400).json({ success: false, message: 'A valid reel is required' })
    }
    const reel = await Reel.findById(reelId).select('status')
    if (!reel || reel.status !== 'PUBLISHED') {
      return res.status(404).json({ success: false, message: 'This reel is no longer available' })
    }

    const ids = [...new Set((recipientIds ?? []).map(String))].filter(id => id !== senderId)
    if (!ids.length) return res.status(400).json({ success: false, message: 'Choose at least one person' })
    if (ids.length > MAX_SHARE_RECIPIENTS) {
      return res.status(400).json({ success: false, message: `You can send to up to ${MAX_SHARE_RECIPIENTS} people at once` })
    }
    if (ids.some(id => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: 'Invalid recipient' })
    }
    const found = await User.find({ _id: { $in: ids }, isSuspended: { $ne: true } }).select('_id').lean()
    if (found.length !== ids.length) {
      return res.status(404).json({ success: false, message: 'One of those people could not be found' })
    }

    const text = String(note ?? '').trim().slice(0, 2000)
    const sent: { recipientId: string; conversationId: string }[] = []
    for (const rid of ids) {
      const conversation = await directConversation(senderId, rid)
      await deliverMessage(conversation, senderId, { content: text, sharedReel: reelId })
      sent.push({ recipientId: rid, conversationId: String(conversation._id) })
    }

    // Every send is a share, as the count on a reel means on Instagram.
    await Reel.updateOne({ _id: reelId }, { $inc: { shareCount: sent.length } })

    res.status(201).json({ success: true, data: { sent: sent.length, conversations: sent } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
