import mongoose, { Schema, Document } from 'mongoose'
import type { ContentType } from './InteractionEvent'

export type DistributionStage = 'TEST' | 'EXPANSION' | 'BROAD' | 'VIRAL' | 'SUPPRESSED'
export type QualityFlag = 'OK' | 'LOW_RETENTION' | 'ENGAGEMENT_BAIT' | 'SUSPICIOUS'

// Rolling short-window counters for velocity / viral detection
interface VelocityWindow {
  since: Date
  impressions: number
  completes: number
  shares: number
  saves: number
  follows: number
}

export interface IContentStats extends Document {
  contentId: mongoose.Types.ObjectId
  contentType: ContentType
  creatorId: mongoose.Types.ObjectId
  topics: string[]
  contentCreatedAt: Date

  stage: DistributionStage
  quality: QualityFlag

  // Lifetime aggregates
  impressions: number
  viewStarts: number
  completes: number
  totalWatchMs: number
  rewatches: number
  skips: number
  likes: number
  saves: number
  shares: number
  comments: number
  profileVisits: number
  followsGenerated: number
  uniqueViewers: number       // approximate (incremented on first view per session)

  window: VelocityWindow

  score: number               // current ranking score (0..~1+)
  scoreUpdatedAt: Date
  stageUpdatedAt: Date
  lastEventAt: Date
  createdAt: Date
  updatedAt: Date
}

const ContentStatsSchema = new Schema<IContentStats>({
  contentId:       { type: Schema.Types.ObjectId, required: true, unique: true },
  contentType:     { type: String, enum: ['REEL', 'PRODUCT'], required: true },
  creatorId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  topics:          [{ type: String }],
  contentCreatedAt:{ type: Date, required: true },

  stage:   { type: String, enum: ['TEST', 'EXPANSION', 'BROAD', 'VIRAL', 'SUPPRESSED'], default: 'TEST' },
  quality: { type: String, enum: ['OK', 'LOW_RETENTION', 'ENGAGEMENT_BAIT', 'SUSPICIOUS'], default: 'OK' },

  impressions:      { type: Number, default: 0 },
  viewStarts:       { type: Number, default: 0 },
  completes:        { type: Number, default: 0 },
  totalWatchMs:     { type: Number, default: 0 },
  rewatches:        { type: Number, default: 0 },
  skips:            { type: Number, default: 0 },
  likes:            { type: Number, default: 0 },
  saves:            { type: Number, default: 0 },
  shares:           { type: Number, default: 0 },
  comments:         { type: Number, default: 0 },
  profileVisits:    { type: Number, default: 0 },
  followsGenerated: { type: Number, default: 0 },
  uniqueViewers:    { type: Number, default: 0 },

  window: {
    since:       { type: Date, default: Date.now },
    impressions: { type: Number, default: 0 },
    completes:   { type: Number, default: 0 },
    shares:      { type: Number, default: 0 },
    saves:       { type: Number, default: 0 },
    follows:     { type: Number, default: 0 },
  },

  score:          { type: Number, default: 0 },
  scoreUpdatedAt: { type: Date, default: Date.now },
  stageUpdatedAt: { type: Date, default: Date.now },
  lastEventAt:    { type: Date, default: Date.now },
}, { timestamps: true })

// Candidate retrieval: trending by stage+score, fresh content needing impressions
ContentStatsSchema.index({ contentType: 1, stage: 1, score: -1 })
ContentStatsSchema.index({ stage: 1, impressions: 1 })            // cold-start sampling
ContentStatsSchema.index({ creatorId: 1, score: -1 })
ContentStatsSchema.index({ topics: 1, score: -1 })
ContentStatsSchema.index({ scoreUpdatedAt: 1 })                  // job: re-score stale

export default mongoose.model<IContentStats>('ContentStats', ContentStatsSchema)
