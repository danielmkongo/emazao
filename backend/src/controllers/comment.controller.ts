import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Comment from '../models/Comment'
import Reel from '../models/Reel'
import Like from '../models/Like'
import User from '../models/User'
import { sendNotification } from '../services/notification.service'

const PAGE = 30
const AUTHOR = 'name username avatar isVerified'

/** Mark which of these comments the viewer has liked. One query per page. */
async function withLikes(comments: any[], viewerId?: string) {
  if (!viewerId || !comments.length) return comments.map(c => ({ ...c, userLiked: false }))
  const likes = await Like.find({
    userId: viewerId, targetType: 'Comment', targetId: { $in: comments.map(c => c._id) },
  }).select('targetId').lean()
  const liked = new Set(likes.map(l => String(l.targetId)))
  return comments.map(c => ({ ...c, userLiked: liked.has(String(c._id)) }))
}

/**
 * GET /api/reels/:id/comments?page= — top-level comments, most liked first, as
 * both apps order them: the comment most people agreed with is the one worth
 * reading first. Replies load separately, on demand.
 */
export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const reelId = String(req.params['id'] ?? '')
    if (!mongoose.isValidObjectId(reelId)) return res.status(400).json({ success: false, message: 'Invalid reel' })
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')) || 1)

    const comments = await Comment.find({ reelId, parentId: { $exists: false } })
      .populate('userId', AUTHOR)
      .sort({ likeCount: -1, createdAt: -1 })
      .skip((page - 1) * PAGE)
      .limit(PAGE)
      .lean()

    res.json({
      success: true,
      data: await withLikes(comments, req.user?.id),
      nextPage: comments.length === PAGE ? page + 1 : null,
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** GET /api/reels/:id/comments/:commentId/replies — a thread, oldest first. */
export const getReplies = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = String(req.params['commentId'] ?? '')
    if (!mongoose.isValidObjectId(parentId)) return res.status(400).json({ success: false, message: 'Invalid comment' })

    const replies = await Comment.find({ parentId })
      .populate('userId', AUTHOR)
      .populate('replyToUserId', 'username')
      .sort({ createdAt: 1 })
      .limit(200)
      .lean()

    res.json({ success: true, data: await withLikes(replies, req.user?.id) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** POST /api/reels/:id/comments — a comment, or a reply when parentId is set. */
export const postComment = async (req: AuthRequest, res: Response) => {
  try {
    const reelId = String(req.params['id'] ?? '')
    const { content, parentId } = req.body as { content?: string; parentId?: string }
    const text = String(content ?? '').trim()
    if (!text) return res.status(400).json({ success: false, message: 'Write something first' })
    if (text.length > 1000) return res.status(400).json({ success: false, message: 'Comments are limited to 1000 characters' })

    const reel = await Reel.findById(reelId).select('status userId')
    if (!reel || reel.status !== 'PUBLISHED') return res.status(404).json({ success: false, message: 'Reel not found' })

    let threadId: mongoose.Types.ObjectId | undefined
    let replyTo: mongoose.Types.ObjectId | undefined
    if (parentId) {
      if (!mongoose.isValidObjectId(parentId)) return res.status(400).json({ success: false, message: 'Invalid comment' })
      const parent = await Comment.findById(parentId).select('reelId parentId userId')
      // Replying across reels would attach the reply to a thread nobody on
      // this reel can see.
      if (!parent || String(parent.reelId) !== reelId) {
        return res.status(404).json({ success: false, message: 'That comment no longer exists' })
      }
      // One level deep: a reply to a reply joins the same thread, remembering
      // who it answered so it can be shown as "@name ...".
      threadId = (parent.parentId ?? parent._id) as mongoose.Types.ObjectId
      replyTo = parent.userId as mongoose.Types.ObjectId
    }

    const created = await Comment.create({
      userId: req.user!.id, reelId, content: text,
      ...(threadId ? { parentId: threadId, replyToUserId: replyTo } : {}),
    })

    // A reel's comment count includes replies, as both apps count them.
    await Reel.updateOne({ _id: reelId }, { $inc: { commentCount: 1 } })
    if (threadId) await Comment.updateOne({ _id: threadId }, { $inc: { replyCount: 1 } })

    const comment = await Comment.findById(created._id)
      .populate('userId', AUTHOR)
      .populate('replyToUserId', 'username')
      .lean()

    // Tell whoever was answered — or, for a new top-level comment, the creator.
    const notifyId = replyTo ? String(replyTo) : String(reel.userId)
    if (notifyId !== req.user!.id) {
      const me = await User.findById(req.user!.id).select('name').lean()
      await sendNotification({
        userId: notifyId,
        type: 'COMMENT',
        title: replyTo ? `${me?.name ?? 'Someone'} replied to your comment` : `${me?.name ?? 'Someone'} commented on your reel`,
        body: text.slice(0, 100),
        link: `/reels/${reelId}`,
      })
    }

    res.status(201).json({ success: true, data: { ...comment, userLiked: false } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * DELETE /api/reels/:id/comments/:commentId — by the comment's author, or by
 * the reel's owner, who on both apps can remove comments from their own post.
 * Deleting a top-level comment takes its thread with it.
 */
export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const commentId = String(req.params['commentId'] ?? '')
    if (!mongoose.isValidObjectId(commentId)) return res.status(400).json({ success: false, message: 'Invalid comment' })

    const comment = await Comment.findById(commentId)
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' })
    const reel = await Reel.findById(comment.reelId).select('userId')
    const uid = req.user!.id
    if (String(comment.userId) !== uid && String(reel?.userId) !== uid) {
      return res.status(403).json({ success: false, message: 'You can only delete your own comments' })
    }

    const replyIds = comment.parentId ? [] : (await Comment.find({ parentId: comment._id }).select('_id').lean()).map(r => r._id)
    const removed = [comment._id, ...replyIds]
    await Comment.deleteMany({ _id: { $in: removed } })
    await Like.deleteMany({ targetType: 'Comment', targetId: { $in: removed } })

    await Reel.updateOne({ _id: comment.reelId, commentCount: { $gte: removed.length } }, { $inc: { commentCount: -removed.length } })
    if (comment.parentId) await Comment.updateOne({ _id: comment.parentId, replyCount: { $gt: 0 } }, { $inc: { replyCount: -1 } })

    res.json({ success: true, data: { removed: removed.length } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
