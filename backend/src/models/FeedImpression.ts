import mongoose, { Schema, Document } from 'mongoose'
import type { ContentType } from './InteractionEvent'

/**
 * Per-user seen-set so feeds don't repeat content and TEST-stage content
 * gets sampled once per user. TTL-expired so it stays small and "seen"
 * naturally resets over a long window. At scale this moves to a Redis
 * per-user bloom filter / sorted-set — the interface stays the same.
 */
export interface IFeedImpression extends Document {
  userId: mongoose.Types.ObjectId
  contentId: mongoose.Types.ObjectId
  contentType: ContentType
  createdAt: Date
}

const FeedImpressionSchema = new Schema<IFeedImpression>({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  contentId:   { type: Schema.Types.ObjectId, required: true },
  contentType: { type: String, enum: ['REEL', 'PRODUCT'], required: true },
  createdAt:   { type: Date, default: Date.now },
})

FeedImpressionSchema.index({ userId: 1, contentId: 1 }, { unique: true })
// Forget "seen" after 14 days so evergreen content can resurface
FeedImpressionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 })

export default mongoose.model<IFeedImpression>('FeedImpression', FeedImpressionSchema)
