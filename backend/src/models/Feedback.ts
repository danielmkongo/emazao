import mongoose, { Schema, Document } from 'mongoose'

/**
 * Feedback about the platform itself, as opposed to a Review, which is about a
 * seller or a product.
 *
 * Kept separate on purpose: a review is public and affects a seller's standing,
 * while this is a private channel to the operators. Mixing them would either
 * publish complaints about eMazao on a farmer's storefront, or bury real
 * service problems inside seller ratings.
 */
export interface IFeedback extends Document {
  userId?: mongoose.Types.ObjectId
  name?: string
  email?: string
  category: 'BUG' | 'SUGGESTION' | 'COMPLAINT' | 'PRAISE' | 'OTHER'
  message: string
  rating?: number
  page?: string
  status: 'NEW' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED'
  adminNote?: string
  handledBy?: mongoose.Types.ObjectId
  createdAt: Date
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    // Optional: a visitor who cannot sign in is often the one with the most
    // useful thing to report, so this must not require an account.
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    category: {
      type: String,
      enum: ['BUG', 'SUGGESTION', 'COMPLAINT', 'PRAISE', 'OTHER'],
      default: 'SUGGESTION',
    },
    message: { type: String, required: true, maxlength: 4000 },
    rating: { type: Number, min: 1, max: 5 },
    // Where they were when they sent it — the single most useful field for
    // reproducing a bug, and free to collect.
    page: { type: String, trim: true },
    status: {
      type: String,
      enum: ['NEW', 'REVIEWING', 'RESOLVED', 'DISMISSED'],
      default: 'NEW',
    },
    adminNote: { type: String, maxlength: 2000 },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

FeedbackSchema.index({ status: 1, createdAt: -1 })
FeedbackSchema.index({ createdAt: -1 })

export default mongoose.model<IFeedback>('Feedback', FeedbackSchema)
