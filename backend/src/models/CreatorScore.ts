import mongoose, { Schema, Document } from 'mongoose'

/**
 * Per-creator (farmer) credibility — the ranked "Top Farmers" signal and a
 * ranking input for their content. Recomputed by a background job from
 * aggregate content performance + commerce trust signals so it reflects
 * REAL measured outcomes, not vanity follower counts.
 */
export interface ICreatorScore extends Document {
  creatorId: mongoose.Types.ObjectId

  // content performance (from ContentStats rollup)
  avgCompletionRate: number
  avgEngagementRate: number
  totalReach: number
  followsGenerated: number
  followConversion: number      // followsGenerated / profileVisits

  // commerce trust (from Orders / Reviews / SellerProfile)
  salesCount: number
  rating: number
  onTimeDelivery: number

  consistency: number           // posting cadence / recency factor
  credibility: number           // final 0..1 composite
  rank?: number                 // cached leaderboard position
  scoreUpdatedAt: Date
  updatedAt: Date
}

const CreatorScoreSchema = new Schema<ICreatorScore>({
  creatorId:         { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  avgCompletionRate: { type: Number, default: 0 },
  avgEngagementRate: { type: Number, default: 0 },
  totalReach:        { type: Number, default: 0 },
  followsGenerated:  { type: Number, default: 0 },
  followConversion:  { type: Number, default: 0 },
  salesCount:        { type: Number, default: 0 },
  rating:            { type: Number, default: 0 },
  onTimeDelivery:    { type: Number, default: 0 },
  consistency:       { type: Number, default: 0 },
  credibility:       { type: Number, default: 0 },
  rank:              { type: Number },
  scoreUpdatedAt:    { type: Date, default: Date.now },
}, { timestamps: true })

CreatorScoreSchema.index({ credibility: -1 })

export default mongoose.model<ICreatorScore>('CreatorScore', CreatorScoreSchema)
