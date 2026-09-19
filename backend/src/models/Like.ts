import mongoose, { Schema, Document } from 'mongoose'

export interface ILike extends Document {
  userId: mongoose.Types.ObjectId
  targetId: mongoose.Types.ObjectId
  targetType: 'Product' | 'Reel' | 'Comment'
  createdAt: Date
}

const LikeSchema = new Schema<ILike>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, refPath: 'targetType' },
    targetType: { type: String, enum: ['Product', 'Reel', 'Comment'], required: true },
  },
  { timestamps: true }
)

LikeSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true })
LikeSchema.index({ targetId: 1, targetType: 1 })
// The profile's private Liked tab: your likes of one kind, newest first.
LikeSchema.index({ userId: 1, targetType: 1, createdAt: -1 })

export default mongoose.model<ILike>('Like', LikeSchema)
