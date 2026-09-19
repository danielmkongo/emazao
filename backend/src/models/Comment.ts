import mongoose, { Schema, Document } from 'mongoose'

/**
 * A comment on a reel, or a reply to one.
 *
 * Threads are one level deep, as on Instagram and TikTok: a reply to a reply is
 * stored under the same top-level comment, with `replyToUserId` recording whose
 * reply it answered so the client can show "@name". Deeper nesting reads badly
 * on a phone-width screen and nobody can follow it.
 */
export interface IComment extends Document {
  userId: mongoose.Types.ObjectId
  reelId: mongoose.Types.ObjectId
  parentId?: mongoose.Types.ObjectId
  replyToUserId?: mongoose.Types.ObjectId
  content: string
  likeCount: number
  replyCount: number
  createdAt: Date
  updatedAt: Date
}

const CommentSchema = new Schema<IComment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reelId: { type: Schema.Types.ObjectId, ref: 'Reel', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
    replyToUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true, maxlength: 1000 },
    likeCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

CommentSchema.index({ reelId: 1, createdAt: -1 })
// Top-level comments for a reel, most-liked first.
CommentSchema.index({ reelId: 1, parentId: 1, likeCount: -1, createdAt: -1 })
// A thread's replies, oldest first so the conversation reads in order.
CommentSchema.index({ parentId: 1, createdAt: 1 })

export default mongoose.model<IComment>('Comment', CommentSchema)
