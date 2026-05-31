import mongoose, { Schema, Document } from 'mongoose'

export type ContentType = 'REEL' | 'PRODUCT'
export type EventType =
  | 'impression' | 'view_start' | 'watch' | 'complete' | 'rewatch'
  | 'like' | 'unlike' | 'save' | 'unsave' | 'share' | 'comment'
  | 'skip' | 'swipe' | 'profile_visit' | 'follow'
export type EventSource = 'feed' | 'reels' | 'explore' | 'profile' | 'live' | 'marketplace'

export interface IInteractionEvent extends Document {
  userId: mongoose.Types.ObjectId
  contentId: mongoose.Types.ObjectId
  contentType: ContentType
  creatorId?: mongoose.Types.ObjectId
  event: EventType
  watchMs?: number
  pctWatched?: number      // 0..1
  source?: EventSource
  sessionId?: string
  createdAt: Date
}

const InteractionEventSchema = new Schema<IInteractionEvent>({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  contentId:   { type: Schema.Types.ObjectId, required: true },
  contentType: { type: String, enum: ['REEL', 'PRODUCT'], required: true },
  creatorId:   { type: Schema.Types.ObjectId, ref: 'User' },
  event:       { type: String, required: true },
  watchMs:     { type: Number },
  pctWatched:  { type: Number },
  source:      { type: String },
  sessionId:   { type: String },
  createdAt:   { type: Date, default: Date.now },
})

// Query patterns: per-content recent events, per-user history
InteractionEventSchema.index({ contentId: 1, createdAt: -1 })
InteractionEventSchema.index({ userId: 1, createdAt: -1 })
// Raw events self-expire after 90 days (aggregates live on in ContentStats)
InteractionEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 })

export default mongoose.model<IInteractionEvent>('InteractionEvent', InteractionEventSchema)
