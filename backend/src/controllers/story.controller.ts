import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Story, { STORY_BACKGROUNDS, STORY_LIFETIME_MS } from '../models/Story'
import StoryView from '../models/StoryView'
import Follow from '../models/Follow'
import Product from '../models/Product'
import User from '../models/User'
import { deliverMessage, directConversation, retractStoryReaction } from './message.controller'

const AUTHOR_FIELDS = 'name username avatar isVerified role'
const PRODUCT_FIELDS = 'title price priceUnit images slug status'
/** Enough for a busy market day, not enough to flood everyone's rail. */
const MAX_ACTIVE_STORIES = 30
/** Stories from people you do not follow, shown after your own circle. */
const SUGGESTED_AUTHORS = 12
const REACTIONS = ['❤️', '🔥', '😍', '👏', '😂', '😮', '🌾', '💰']

const active = () => ({ expiresAt: { $gt: new Date() } })

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch { return false }
}

/**
 * Group stories into one entry per author, oldest story first inside each so
 * the viewer plays them in the order they were posted, and mark what the
 * viewer has already seen.
 */
async function groupForViewer(stories: any[], viewerId?: string) {
  const seen = new Set<string>()
  // What this viewer reacted with, if anything: a reaction is a toggle, so the
  // viewer has to be told which story they have already reacted to.
  const mine = new Map<string, string>()
  if (viewerId && stories.length) {
    const views = await StoryView.find({ viewerId, storyId: { $in: stories.map(s => s._id) } }).select('storyId reaction').lean()
    views.forEach(v => {
      seen.add(String(v.storyId))
      if (v.reaction) mine.set(String(v.storyId), v.reaction)
    })
  }
  const groups = new Map<string, { user: any; stories: any[]; latestAt: Date; allSeen: boolean }>()
  for (const s of stories) {
    const author = s.userId
    if (!author?._id) continue
    const key = String(author._id)
    const story = { ...s, userId: key, seen: seen.has(String(s._id)) || key === viewerId, myReaction: mine.get(String(s._id)) }
    const g = groups.get(key)
    if (g) {
      g.stories.push(story)
      if (s.createdAt > g.latestAt) g.latestAt = s.createdAt
    } else {
      groups.set(key, { user: author, stories: [story], latestAt: s.createdAt, allSeen: true })
    }
  }
  for (const g of groups.values()) {
    g.stories.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    g.allSeen = g.stories.every(s => s.seen)
  }
  return [...groups.values()]
}

/**
 * GET /api/stories/feed — the rail across the top of the feed.
 *
 * Your own first, then people you follow with something unseen (newest
 * first), then the ones you have already watched. Someone new who follows
 * nobody would otherwise see an empty rail, so it tops up with active stories
 * from other sellers — on a marketplace that is discovery, not noise.
 */
export const getStoryFeed = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!.id
    const following = await Follow.find({ followerId: me }).select('followingId').lean()
    const circle = [me, ...following.map(f => String(f.followingId))]

    const own = await Story.find({ userId: { $in: circle }, ...active() })
      .populate('userId', AUTHOR_FIELDS).populate('productId', PRODUCT_FIELDS)
      .sort({ createdAt: -1 }).limit(500).lean()

    const suggestedIds = await Story.aggregate([
      { $match: { userId: { $nin: circle.map(id => new mongoose.Types.ObjectId(id)) }, expiresAt: { $gt: new Date() } } },
      { $group: { _id: '$userId', latest: { $max: '$createdAt' }, views: { $sum: '$viewCount' } } },
      { $sort: { views: -1, latest: -1 } },
      { $limit: SUGGESTED_AUTHORS },
    ])
    const suggested = suggestedIds.length
      ? await Story.find({ userId: { $in: suggestedIds.map(s => s._id) }, ...active() })
        .populate('userId', AUTHOR_FIELDS).populate('productId', PRODUCT_FIELDS).lean()
      : []

    const mine = await groupForViewer(own, me)
    const others = (await groupForViewer(suggested, me)).map(g => ({ ...g, suggested: true }))

    const byRecency = (a: any, b: any) => +new Date(b.latestAt) - +new Date(a.latestAt)
    const self = mine.filter(g => String(g.user._id) === me)
    const circleGroups = mine.filter(g => String(g.user._id) !== me)
    const ordered = [
      ...self,
      ...circleGroups.filter(g => !g.allSeen).sort(byRecency),
      ...others.filter(g => !g.allSeen).sort(byRecency),
      ...circleGroups.filter(g => g.allSeen).sort(byRecency),
      ...others.filter(g => g.allSeen).sort(byRecency),
    ]
    res.json({ success: true, data: ordered })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** GET /api/stories/user/:userId — one person's active stories (profile ring). */
export const getUserStories = async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user' })
    }
    const stories = await Story.find({ userId: req.params.userId, ...active() })
      .populate('userId', AUTHOR_FIELDS).populate('productId', PRODUCT_FIELDS)
      .sort({ createdAt: 1 }).lean()
    const [group] = await groupForViewer(stories, req.user?.id)
    res.json({ success: true, data: group ?? null })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** POST /api/stories — post a photo, video or text story. */
export const createStory = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!.id
    const { mediaUrl, mediaType, text, background, caption, productId } = req.body ?? {}

    const hasMedia = mediaUrl !== undefined && mediaUrl !== null && mediaUrl !== ''
    const cleanText = typeof text === 'string' ? text.trim() : ''
    if (!hasMedia && !cleanText) {
      return res.status(400).json({ success: false, message: 'A story needs a photo, a video or some text' })
    }
    if (hasMedia && (!isHttpUrl(mediaUrl) || !['IMAGE', 'VIDEO'].includes(mediaType))) {
      return res.status(400).json({ success: false, message: 'Invalid media' })
    }
    if (cleanText.length > 280) return res.status(400).json({ success: false, message: 'Text is limited to 280 characters' })
    if (caption && (typeof caption !== 'string' || caption.length > 200)) {
      return res.status(400).json({ success: false, message: 'Caption is limited to 200 characters' })
    }
    if (background && !STORY_BACKGROUNDS.includes(background)) {
      return res.status(400).json({ success: false, message: 'Unknown background' })
    }

    // Only your own, live listing can go on your story — otherwise a story
    // could advertise someone else's goods under your name.
    let product = null
    if (productId) {
      if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ success: false, message: 'Invalid product' })
      product = await Product.findOne({ _id: productId, sellerId: me, status: 'ACTIVE' }).select('_id')
      if (!product) return res.status(400).json({ success: false, message: 'You can only tag your own active listings' })
    }

    const count = await Story.countDocuments({ userId: me, ...active() })
    if (count >= MAX_ACTIVE_STORIES) {
      return res.status(429).json({ success: false, message: `You can have up to ${MAX_ACTIVE_STORIES} stories up at once` })
    }

    const story = await Story.create({
      userId: me,
      ...(hasMedia ? { mediaUrl, mediaType } : { text: cleanText, background: background ?? 'harvest' }),
      ...(hasMedia && cleanText ? { text: cleanText } : {}),
      caption: caption?.trim() || undefined,
      productId: product?._id,
      expiresAt: new Date(Date.now() + STORY_LIFETIME_MS),
    })
    await story.populate('userId', AUTHOR_FIELDS)
    await story.populate('productId', PRODUCT_FIELDS)
    res.status(201).json({ success: true, data: story })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** POST /api/stories/:id/view — record that the signed-in viewer saw it. */
export const viewStory = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!.id
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid story' })
    const story = await Story.findOne({ _id: req.params.id, ...active() }).select('userId')
    if (!story) return res.status(404).json({ success: false, message: 'Story has expired' })
    if (String(story.userId) === me) return res.json({ success: true })

    // Upsert and count only a genuinely new view, so rewatching does not
    // inflate the number the author sees.
    const result = await StoryView.updateOne(
      { storyId: story._id, viewerId: me },
      { $setOnInsert: { ownerId: story.userId } },
      { upsert: true },
    )
    if (result.upsertedCount) await Story.updateOne({ _id: story._id }, { $inc: { viewCount: 1 } })
    res.json({ success: true })
  } catch (err: any) {
    // Two taps racing on the unique index: the view is recorded either way.
    if (err?.code === 11000) return res.json({ success: true })
    res.status(500).json({ success: false, message: err.message })
  }
}

/** GET /api/stories/:id/viewers — who saw it. Author only. */
export const getStoryViewers = async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid story' })
    const story = await Story.findById(req.params.id).select('userId viewCount reactionCount')
    if (!story) return res.status(404).json({ success: false, message: 'Story not found' })
    if (String(story.userId) !== req.user!.id) return res.status(403).json({ success: false, message: 'Forbidden' })

    const views = await StoryView.find({ storyId: story._id })
      .sort({ createdAt: -1 }).limit(500)
      .populate('viewerId', AUTHOR_FIELDS).lean()
    res.json({
      success: true,
      data: {
        viewCount: story.viewCount,
        reactionCount: story.reactionCount,
        viewers: views.filter(v => v.viewerId).map(v => ({ user: v.viewerId, reaction: v.reaction, viewedAt: v.createdAt })),
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/stories/:id/reply — a message or a one-tap reaction.
 *
 * Both arrive in the author's direct messages with a snapshot of the story,
 * the way Instagram does it: a reply to a story is the start of a
 * conversation, and on eMazao usually of a sale.
 */
export const replyToStory = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!.id
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
    const reaction = typeof req.body?.reaction === 'string' ? req.body.reaction : undefined
    if (!content && !reaction) return res.status(400).json({ success: false, message: 'Write a reply or pick a reaction' })
    if (content.length > 1000) return res.status(400).json({ success: false, message: 'Reply is too long' })
    if (reaction && !REACTIONS.includes(reaction)) return res.status(400).json({ success: false, message: 'Unknown reaction' })
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid story' })

    const story = await Story.findOne({ _id: req.params.id, ...active() })
    if (!story) return res.status(404).json({ success: false, message: 'Story has expired' })
    const ownerId = String(story.userId)
    if (ownerId === me) return res.status(400).json({ success: false, message: 'You cannot reply to your own story' })

    const owner = await User.findById(ownerId).select('_id isActive')
    if (!owner) return res.status(404).json({ success: false, message: 'User not found' })

    // A reaction is a toggle on the story, not a stream of messages: tapping
    // the heart ten times used to send ten messages the owner had to read.
    // Reacting again with the same emoji takes it back; a different emoji
    // replaces it. Either way the viewer leaves exactly one message behind.
    // A reaction sent with a written reply is part of that reply, so it is left
    // alone here.
    const isToggle = !!reaction && !content
    if (isToggle) {
      const prev = await StoryView.findOne({ storyId: story._id, viewerId: me }).select('reaction')
      const undo = prev?.reaction === reaction
      await StoryView.updateOne(
        { storyId: story._id, viewerId: me },
        undo
          ? { $unset: { reaction: '' }, $setOnInsert: { ownerId: story.userId } }
          : { $set: { reaction }, $setOnInsert: { ownerId: story.userId } },
        { upsert: true },
      )
      if (undo && prev?.reaction) await Story.updateOne({ _id: story._id }, { $inc: { reactionCount: -1 } })
      if (!undo && !prev?.reaction) await Story.updateOne({ _id: story._id }, { $inc: { reactionCount: 1 } })

      // Retract whatever the last tap left in the chat before sending anything.
      const conv = await directConversation(me, ownerId)
      await retractStoryReaction(conv, me, String(story._id))
      if (undo) {
        return res.json({ success: true, data: { reacted: false, conversationId: conv._id } })
      }
      const message = await deliverMessage(conv, me, {
        content: '',
        storyReply: {
          storyId: story._id, ownerId: story.userId, mediaUrl: story.mediaUrl,
          mediaType: story.mediaType, text: story.text, background: story.background, reaction,
        },
      })
      return res.status(201).json({ success: true, data: { reacted: true, reaction, message, conversationId: conv._id } })
    }

    if (reaction) {
      const prev = await StoryView.findOneAndUpdate(
        { storyId: story._id, viewerId: me },
        { $set: { reaction }, $setOnInsert: { ownerId: story.userId } },
        { upsert: true, returnDocument: 'before' },
      )
      if (!prev?.reaction) await Story.updateOne({ _id: story._id }, { $inc: { reactionCount: 1 } })
    }

    const conversation = await directConversation(me, ownerId)
    const message = await deliverMessage(conversation, me, {
      content,
      storyReply: {
        storyId: story._id,
        ownerId: story.userId,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        text: story.text,
        background: story.background,
        reaction,
      },
    })
    res.status(201).json({ success: true, data: { message, conversationId: conversation._id } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/stories/:id — one story, if it is still up.
 *
 * A story reply in a chat keeps its own snapshot of what the story showed, so
 * the conversation still makes sense next week. But while the story is alive
 * the snapshot is a poor substitute for the real thing — it has no video, no
 * attached produce and no progress bar — so tapping the card opens the story
 * itself, and falls back to the snapshot once it has expired.
 */
export const getStory = async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid story' })
    const story = await Story.findOne({ _id: req.params.id, ...active() })
      .populate('userId', AUTHOR_FIELDS)
      .populate('productId', PRODUCT_FIELDS)
      .lean()
    // 404 is the honest answer: expired and never-existed are the same thing
    // to a viewer, and the caller shows its saved copy either way.
    if (!story) return res.status(404).json({ success: false, message: 'Story has expired' })

    const mine = req.user?.id
      ? await StoryView.findOne({ storyId: story._id, viewerId: req.user.id }).select('reaction').lean()
      : null
    const author: any = story.userId
    res.json({
      success: true,
      data: {
        user: author,
        stories: [{ ...story, userId: String(author?._id ?? author), seen: !!mine, myReaction: mine?.reaction }],
        allSeen: !!mine,
        latestAt: story.createdAt,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** DELETE /api/stories/:id — take a story down early. */
export const deleteStory = async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid story' })
    const story = await Story.findById(req.params.id).select('userId')
    if (!story) return res.status(404).json({ success: false, message: 'Story not found' })
    if (String(story.userId) !== req.user!.id) return res.status(403).json({ success: false, message: 'Forbidden' })
    await Promise.all([Story.deleteOne({ _id: story._id }), StoryView.deleteMany({ storyId: story._id })])
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export { REACTIONS as STORY_REACTIONS }
