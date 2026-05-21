import mongoose, { Schema, Document } from 'mongoose'

export interface IComment extends Document {
  userId: mongoose.Types.ObjectId
  reelId: mongoose.Types.ObjectId
  parentId?: mongoose.Types.ObjectId
  content: string
  likeCount: number
  createdAt: Date
  updatedAt: Date
}

const CommentSchema = new Schema<IComment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reelId: { type: Schema.Types.ObjectId, ref: 'Reel', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
    content: { type: String, required: true, maxlength: 1000 },
    likeCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

CommentSchema.index({ reelId: 1, createdAt: -1 })

export default mongoose.model<IComment>('Comment', CommentSchema)
