import mongoose, { Schema, Document } from 'mongoose'

/**
 * Per-user evolving preference profile.
 * `topics` and `creators` are affinity vectors (Map<key, weight>).
 * Weights are time-decayed on every write (decay-on-write — no cron needed):
 * before applying a new bump, existing weights are multiplied by
 * decay^(hoursSinceLastDecay), so recent behavior dominates old behavior.
 */
export interface IUserInterest extends Document {
  userId: mongoose.Types.ObjectId
  topics: Map<string, number>
  creators: Map<string, number>
  lastDecayAt: Date

  // behavioral summary
  avgWatchPct: number
  watchSamples: number
  events: number

  updatedAt: Date
  createdAt: Date
}

const UserInterestSchema = new Schema<IUserInterest>({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  topics:      { type: Map, of: Number, default: {} },
  creators:    { type: Map, of: Number, default: {} },
  lastDecayAt: { type: Date, default: Date.now },

  avgWatchPct:  { type: Number, default: 0 },
  watchSamples: { type: Number, default: 0 },
  events:       { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model<IUserInterest>('UserInterest', UserInterestSchema)
