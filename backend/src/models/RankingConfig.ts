import mongoose, { Schema, Document } from 'mongoose'

/**
 * Single source of truth for ALL ranking weights & distribution thresholds.
 * Editable at runtime by admins (no code change / redeploy). Supports A/B
 * variants keyed by `key` ('default' is the control). Feed code reads the
 * active config via the cached loader in services/recommendation/config.ts.
 */
export interface IRankingConfig extends Document {
  key: string
  active: boolean

  // How ranking factors combine into a content score (0..1 each, weighted sum)
  weights: {
    completion: number
    watchTime: number
    rewatch: number
    share: number
    save: number
    comment: number
    followConv: number
    creatorCredibility: number
    freshness: number
    interestMatch: number
    proximity: number
  }

  // Stage promotion/demotion gates (performance score thresholds + min sample)
  stageThresholds: {
    minImpressions: number       // min impressions before a stage decision
    testToExpansion: number
    expansionToBroad: number
    broadToViral: number
    suppressBelow: number
  }

  // Viral detection (velocity over a short rolling window)
  viral: {
    windowMinutes: number
    minImpressions: number
    shareVelocity: number        // shares / impressions in window
    saveVelocity: number
    followVelocity: number
    completionRate: number
  }

  // Quality protection
  quality: {
    maxSkipRate: number
    minCompletionRate: number
    minImpressions: number
  }

  // Feed generation
  exploration: { epsilon: number }   // fraction of feed for discovery
  diversity: {
    maxConsecutiveSameCreator: number
    maxPerCreatorPerPage: number
    maxPerTopicPerPage: number
  }
  coldStart: { targetImpressions: number; injectionBoost: number }

  updatedAt: Date
}

const RankingConfigSchema = new Schema<IRankingConfig>({
  key:    { type: String, required: true, unique: true, default: 'default' },
  active: { type: Boolean, default: true },

  weights: {
    completion:         { type: Number, default: 0.20 },
    watchTime:          { type: Number, default: 0.15 },
    rewatch:            { type: Number, default: 0.05 },
    share:              { type: Number, default: 0.12 },
    save:               { type: Number, default: 0.10 },
    comment:            { type: Number, default: 0.06 },
    followConv:         { type: Number, default: 0.10 },
    creatorCredibility: { type: Number, default: 0.07 },
    freshness:          { type: Number, default: 0.07 },
    interestMatch:      { type: Number, default: 0.05 },
    proximity:          { type: Number, default: 0.03 },
  },

  stageThresholds: {
    minImpressions:   { type: Number, default: 50 },
    testToExpansion:  { type: Number, default: 0.45 },
    expansionToBroad: { type: Number, default: 0.55 },
    broadToViral:     { type: Number, default: 0.72 },
    suppressBelow:    { type: Number, default: 0.18 },
  },

  viral: {
    windowMinutes:  { type: Number, default: 60 },
    minImpressions: { type: Number, default: 200 },
    shareVelocity:  { type: Number, default: 0.08 },
    saveVelocity:   { type: Number, default: 0.12 },
    followVelocity: { type: Number, default: 0.04 },
    completionRate: { type: Number, default: 0.65 },
  },

  quality: {
    maxSkipRate:       { type: Number, default: 0.7 },
    minCompletionRate: { type: Number, default: 0.12 },
    minImpressions:    { type: Number, default: 80 },
  },

  exploration: { epsilon: { type: Number, default: 0.15 } },
  diversity: {
    maxConsecutiveSameCreator: { type: Number, default: 1 },
    maxPerCreatorPerPage:      { type: Number, default: 3 },
    maxPerTopicPerPage:        { type: Number, default: 5 },
  },
  coldStart: {
    targetImpressions: { type: Number, default: 50 },
    injectionBoost:    { type: Number, default: 0.25 },
  },
}, { timestamps: true })

export default mongoose.model<IRankingConfig>('RankingConfig', RankingConfigSchema)
