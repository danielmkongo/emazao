import { describe, it, expect, vi } from 'vitest'
import mongoose from 'mongoose'
import User from '../src/models/User'
import Story from '../src/models/Story'
import Message from '../src/models/Message'
import Notification from '../src/models/Notification'
import Conversation from '../src/models/Conversation'
import { replyToStory } from '../src/controllers/story.controller'
import { markRead, getUnreadCount } from '../src/controllers/message.controller'
import { mockReq, mockRes } from './helpers'

// The socket layer is not running under test; reactions still have to work.
vi.mock('../src/socket', () => ({ isUserOnline: () => false, emitToRoom: () => {} }))

async function pair() {
  const owner = await User.create({ name: 'Owner', email: 'o@test.com', username: 'owner', role: 'FARMER' })
  const fan = await User.create({ name: 'Fan', email: 'f@test.com', username: 'fan', role: 'BUYER' })
  const story = await Story.create({
    userId: owner._id, mediaUrl: 'https://x/y.jpg', mediaType: 'IMAGE',
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  return { owner, fan, story }
}

const react = async (fanId: string, storyId: mongoose.Types.ObjectId, reaction: string) => {
  const res = mockRes()
  await replyToStory(mockReq({ user: { id: fanId }, params: { id: String(storyId) }, body: { reaction } }), res)
  return res
}

describe('story reactions are a toggle, not a stream of messages', () => {
  it('leaves one message however many times the heart is tapped', async () => {
    const { owner, fan, story } = await pair()

    await react(String(fan._id), story._id, '❤️')
    await react(String(fan._id), story._id, '❤️') // un-likes
    await react(String(fan._id), story._id, '❤️') // likes again

    const messages = await Message.find({ senderId: fan._id })
    expect(messages).toHaveLength(1)

    const fresh = await Story.findById(story._id)
    expect(fresh!.reactionCount).toBe(1)
    expect(String(owner._id)).toBeTruthy()
  })

  it('takes the reaction back when the same emoji is tapped again', async () => {
    const { fan, story } = await pair()

    await react(String(fan._id), story._id, '🔥')
    const res = await react(String(fan._id), story._id, '🔥')

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reacted: false }),
    }))
    expect(await Message.countDocuments({ senderId: fan._id })).toBe(0)
    expect((await Story.findById(story._id))!.reactionCount).toBe(0)
  })

  it('replaces the reaction rather than adding one when a different emoji is picked', async () => {
    const { fan, story } = await pair()

    await react(String(fan._id), story._id, '❤️')
    await react(String(fan._id), story._id, '👏')

    const messages = await Message.find({ senderId: fan._id })
    expect(messages).toHaveLength(1)
    expect(messages[0]!.storyReply!.reaction).toBe('👏')
    expect((await Story.findById(story._id))!.reactionCount).toBe(1)
  })
})

describe('reading a thread clears its reactions', () => {
  it('leaves the owner with no unread messages once they open it', async () => {
    const { owner, fan, story } = await pair()
    await react(String(fan._id), story._id, '❤️')

    const conversation = await Conversation.findOne({ participants: { $all: [owner._id, fan._id] } })
    expect(conversation).toBeTruthy()

    const before = mockRes()
    await getUnreadCount(mockReq({ user: { id: String(owner._id) } }), before)
    expect(before.json).toHaveBeenCalledWith({ success: true, data: { count: 1 } })

    const readRes = mockRes()
    await markRead(mockReq({ user: { id: String(owner._id) }, params: { conversationId: String(conversation!._id) } }), readRes)

    const after = mockRes()
    await getUnreadCount(mockReq({ user: { id: String(owner._id) } }), after)
    expect(after.json).toHaveBeenCalledWith({ success: true, data: { count: 0 } })

    // …and the bell stops counting it too.
    expect(await Notification.countDocuments({ userId: owner._id, isRead: { $ne: true } })).toBe(0)
  })
})
