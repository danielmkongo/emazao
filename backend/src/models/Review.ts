import mongoose, { Schema, Document } from 'mongoose'

export interface IReview extends Document {
  authorId: mongoose.Types.ObjectId
  targetId: mongoose.Types.ObjectId
  productId?: mongoose.Types.ObjectId
  orderId?: mongoose.Types.ObjectId
  rating: number
  title?: string
  content: string
  images: string[]
  isVerifiedPurchase: boolean
  createdAt: Date
}

const ReviewSchema = new Schema<IReview>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String },
    content: { type: String, required: true },
    images: [{ type: String }],
    isVerifiedPurchase: { type: Boolean, default: false },
  },
  { timestamps: true }
)

ReviewSchema.index({ targetId: 1 })
ReviewSchema.index({ productId: 1 })

export default mongoose.model<IReview>('Review', ReviewSchema)
