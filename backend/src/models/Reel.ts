import mongoose, { Schema, Document } from 'mongoose'

export type ContentStatus = 'PUBLISHED' | 'DRAFT' | 'UNDER_REVIEW' | 'REMOVED'

export interface IReel extends Document {
  userId: mongoose.Types.ObjectId
  productId?: mongoose.Types.ObjectId
  title?: string
  caption?: string
  videoUrl: string
  thumbnailUrl?: string
  duration?: number
  tags: string[]
  viewCount: number
  likeCount: number
  commentCount: number
  shareCount: number
  totalWatchTime: number
  status: ContentStatus
  isBoosted: boolean
  boostExpiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

const ReelSchema = new Schema<IReel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    title: { type: String },
    caption: { type: String },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    duration: { type: Number },
    tags: [{ type: String }],
    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    totalWatchTime: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['PUBLISHED', 'DRAFT', 'UNDER_REVIEW', 'REMOVED'],
      default: 'PUBLISHED',
    },
    isBoosted: { type: Boolean, default: false },
    boostExpiresAt: { type: Date },
  },
  { timestamps: true }
)

ReelSchema.index({ userId: 1 })
ReelSchema.index({ tags: 1 })
ReelSchema.index({ status: 1, isBoosted: 1 })

export default mongoose.model<IReel>('Reel', ReelSchema)
