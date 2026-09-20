import { describe, it, expect, vi } from 'vitest'
import User from '../src/models/User'
import Message from '../src/models/Message'
import Conversation from '../src/models/Conversation'
import {
  sendMessage, recallMessage, editMessage, clearConversation,
  getMessages, getConversations, getUnreadCount, EDIT_WINDOW_MS,
} from '../src/controllers/message.controller'
import { mockReq, mockRes } from './helpers'

vi.mock('../src/socket', () => ({ isUserOnline: () => false, emitToRoom: () => {} }))

async function two() {
  const a = await User.create({ name: 'Ali', email: 'a@test.com', username: 'ali', role: 'BUYER' })
  const b = await User.create({ name: 'Bea', email: 'b@test.com', username: 'bea', role: 'FARMER' })
  return { a, b }
}

const say = async (from: string, to: string, content: string, extra: Record<string, unknown> = {}) => {
  const res = mockRes()
  await sendMessage(mockReq({ user: { id: from }, body: { recipientId: to, content, ...extra } }), res)
  return res.json.mock.calls[0][0].data
}

const lastPayload = (res: any) => res.json.mock.calls[res.json.mock.calls.length - 1][0].data

describe('recalling a message', () => {
  it('hides the text from both sides but keeps it for a dispute', async () => {
    const { a, b } = await two()
    const { message, conversationId } = await say(String(a._id), String(b._id), 'wrong price, 5000')

    const res = mockRes()
    await recallMessage(mockReq({ user: { id: String(a._id) }, params: { id: String(message._id) } }), res)
    expect(res.status).not.toHaveBeenCalledWith(400)

    // The recipient is told it was recalled, and gets none of the words.
    const read = mockRes()
    await getMessages(mockReq({ user: { id: String(b._id) }, params: { conversationId } }), read)
    const shown = lastPayload(read)
    expect(shown).toHaveLength(1)
    expect(shown[0].content).toBe('')
    expect(shown[0].recalledAt).toBeTruthy()

    // …but the row still holds what was said.
    const stored = await Message.findById(message._id)
    expect(stored!.content).toBe('wrong price, 5000')
  })

  it('refuses once the window has passed, and refuses other people outright', async () => {
    const { a, b } = await two()
    const { message } = await say(String(a._id), String(b._id), 'hello')
    // Mongoose refuses a manual createdAt while timestamps are on, so age it
    // through the driver rather than the model.
    await Message.collection.updateOne({ _id: message._id }, { $set: { createdAt: new Date(Date.now() - EDIT_WINDOW_MS - 1000) } })

    const late = mockRes()
    await recallMessage(mockReq({ user: { id: String(a._id) }, params: { id: String(message._id) } }), late)
    expect(late.status).toHaveBeenCalledWith(400)

    const { message: fresh } = await say(String(a._id), String(b._id), 'again')
    const notMine = mockRes()
    await recallMessage(mockReq({ user: { id: String(b._id) }, params: { id: String(fresh._id) } }), notMine)
    expect(notMine.status).toHaveBeenCalledWith(403)
  })
})

describe('editing a message', () => {
  it('replaces the text, marks it edited and keeps the original', async () => {
    const { a, b } = await two()
    const { message, conversationId } = await say(String(a._id), String(b._id), 'TZS 2400 per kg')

    const res = mockRes()
    await editMessage(mockReq({ user: { id: String(a._id) }, params: { id: String(message._id) }, body: { content: 'TZS 2600 per kg' } }), res)

    const read = mockRes()
    await getMessages(mockReq({ user: { id: String(b._id) }, params: { conversationId } }), read)
    const shown = lastPayload(read)[0]
    expect(shown.content).toBe('TZS 2600 per kg')
    expect(shown.editedAt).toBeTruthy()
    // History is for admins, never for the other participant.
    expect(shown.editHistory).toBeUndefined()

    const stored = await Message.findById(message._id)
    expect(stored!.editHistory).toHaveLength(1)
    expect(stored!.editHistory![0]!.content).toBe('TZS 2400 per kg')
  })

  it('will not edit a recalled message', async () => {
    const { a, b } = await two()
    const { message } = await say(String(a._id), String(b._id), 'oops')
    await recallMessage(mockReq({ user: { id: String(a._id) }, params: { id: String(message._id) } }), mockRes())

    const res = mockRes()
    await editMessage(mockReq({ user: { id: String(a._id) }, params: { id: String(message._id) }, body: { content: 'fixed' } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})

describe('replying to a message', () => {
  it('quotes a message from the same conversation and refuses one from elsewhere', async () => {
    const { a, b } = await two()
    const c = await User.create({ name: 'Cee', email: 'c@test.com', username: 'cee', role: 'BUYER' })
    const first = await say(String(a._id), String(b._id), 'Is the maize still available?')
    const elsewhere = await say(String(a._id), String(c._id), 'unrelated')

    const ok = await say(String(b._id), String(a._id), 'Yes, 20 tonnes', { replyTo: String(first.message._id) })
    expect(String(ok.message.replyTo._id ?? ok.message.replyTo)).toBe(String(first.message._id))

    const res = mockRes()
    await sendMessage(mockReq({
      user: { id: String(b._id) },
      body: { conversationId: first.conversationId, content: 'sneaky', replyTo: String(elsewhere.message._id) },
    }), res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('deleting a conversation', () => {
  it('empties it for one side only, and leaves the other untouched', async () => {
    const { a, b } = await two()
    const { conversationId } = await say(String(a._id), String(b._id), 'first')
    await say(String(b._id), String(a._id), 'second')

    await clearConversation(mockReq({ user: { id: String(a._id) }, params: { conversationId } }), mockRes())

    const mine = mockRes()
    await getMessages(mockReq({ user: { id: String(a._id) }, params: { conversationId } }), mine)
    expect(lastPayload(mine)).toHaveLength(0)

    const theirs = mockRes()
    await getMessages(mockReq({ user: { id: String(b._id) }, params: { conversationId } }), theirs)
    expect(lastPayload(theirs)).toHaveLength(2)

    // Gone from my inbox, still in theirs.
    const myInbox = mockRes()
    await getConversations(mockReq({ user: { id: String(a._id) } }), myInbox)
    expect(lastPayload(myInbox)).toHaveLength(0)

    const theirInbox = mockRes()
    await getConversations(mockReq({ user: { id: String(b._id) } }), theirInbox)
    expect(lastPayload(theirInbox)).toHaveLength(1)

    // And nothing was actually destroyed.
    expect(await Message.countDocuments({ conversationId })).toBe(2)
  })

  it('comes back when something new is said, starting from empty', async () => {
    const { a, b } = await two()
    const { conversationId } = await say(String(a._id), String(b._id), 'old news')
    await clearConversation(mockReq({ user: { id: String(a._id) }, params: { conversationId } }), mockRes())

    await say(String(b._id), String(a._id), 'are you there?')

    const mine = mockRes()
    await getMessages(mockReq({ user: { id: String(a._id) }, params: { conversationId } }), mine)
    const shown = lastPayload(mine)
    expect(shown).toHaveLength(1)
    expect(shown[0].content).toBe('are you there?')

    const inbox = mockRes()
    await getConversations(mockReq({ user: { id: String(a._id) } }), inbox)
    expect(lastPayload(inbox)).toHaveLength(1)
  })

  it('leaves no unread badge for messages it has hidden', async () => {
    const { a, b } = await two()
    const { conversationId } = await say(String(b._id), String(a._id), 'unread one')
    await say(String(b._id), String(a._id), 'unread two')

    const before = mockRes()
    await getUnreadCount(mockReq({ user: { id: String(a._id) } }), before)
    expect(lastPayload(before)).toEqual({ count: 2 })

    await clearConversation(mockReq({ user: { id: String(a._id) }, params: { conversationId } }), mockRes())

    const after = mockRes()
    await getUnreadCount(mockReq({ user: { id: String(a._id) } }), after)
    expect(lastPayload(after)).toEqual({ count: 0 })
  })

  it('does not let a stranger clear someone else’s conversation', async () => {
    const { a, b } = await two()
    const c = await User.create({ name: 'Cee', email: 'c@test.com', username: 'cee', role: 'BUYER' })
    const { conversationId } = await say(String(a._id), String(b._id), 'private')

    const res = mockRes()
    await clearConversation(mockReq({ user: { id: String(c._id) }, params: { conversationId } }), res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect((await Conversation.findById(conversationId))!.clears ?? []).toHaveLength(0)
  })
})
