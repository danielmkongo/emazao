import type { IContentStats, DistributionStage } from '../../models/ContentStats'
import type { IRankingConfig } from '../../models/RankingConfig'

/** Lightweight view of stats so we can score legacy content with no ContentStats row. */
export interface StatsView {
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
  contentCreatedAt: Date
  stage: DistributionStage
  topics: string[]
  creatorId: string
}

export function statsViewFrom(s: IContentStats): StatsView {
  return {
    impressions: s.impressions, viewStarts: s.viewStarts, completes: s.completes,
    totalWatchMs: s.totalWatchMs, rewatches: s.rewatches, skips: s.skips,
    likes: s.likes, saves: s.saves, shares: s.shares, comments: s.comments,
    profileVisits: s.profileVisits, followsGenerated: s.followsGenerated,
    contentCreatedAt: s.contentCreatedAt, stage: s.stage, topics: s.topics,
    creatorId: s.creatorId.toString(),
  }
}

export function emptyStatsView(createdAt: Date, topics: string[], creatorId: string): StatsView {
  return {
    impressions: 0, viewStarts: 0, completes: 0, totalWatchMs: 0, rewatches: 0, skips: 0,
    likes: 0, saves: 0, shares: 0, comments: 0, profileVisits: 0, followsGenerated: 0,
    contentCreatedAt: createdAt, stage: 'TEST', topics, creatorId,
  }
}

const STAGE_MULT: Record<DistributionStage, number> = {
  TEST: 0.6, EXPANSION: 0.85, BROAD: 1.0, VIRAL: 1.3, SUPPRESSED: 0.08,
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const softCap = (x: number, cap: number) => clamp01(x / cap)

/**
 * Global, per-content quality score in [0,1]. Intrinsic signals only — this is
 * what the stage-promotion job and viral detector read. Uses config weights so
 * it's tunable without code.
 */
export function contentQualityScore(s: StatsView, cfg: IRankingConfig): number {
  const w = cfg.weights
  const imp = Math.max(s.impressions, 1)
  const vs = Math.max(s.viewStarts, 1)

  const completion = clamp01(s.completes / vs)
  const watch = softCap(s.totalWatchMs / vs, 20_000)        // ~20s avg view = full marks
  const rewatch = softCap(s.rewatches / vs, 0.5)
  const share = softCap(s.shares / imp, 0.1)
  const save = softCap(s.saves / imp, 0.15)
  const comment = softCap(s.comments / imp, 0.1)
  const followConv = softCap(s.followsGenerated / Math.max(s.profileVisits, 1), 0.2)
  const hoursOld = (Date.now() - s.contentCreatedAt.getTime()) / 3_600_000
  const freshness = 1 / (1 + hoursOld / 24)

  const skipRate = s.skips / imp
  const skipPenalty = clamp01(skipRate - 0.4) * 0.5         // only penalize heavy skipping

  const score =
    completion * w.completion +
    watch * w.watchTime +
    rewatch * w.rewatch +
    share * w.share +
    save * w.save +
    comment * w.comment +
    followConv * w.followConv +
    freshness * w.freshness

  return Math.max(0, score - skipPenalty)
}

/** Cosine-ish affinity between a user's topic vector and content topics → [0,1]. */
export function interestMatch(topics: string[], userTopics?: Record<string, number> | Map<string, number>): number {
  if (!userTopics || topics.length === 0) return 0
  const get = (k: string) => userTopics instanceof Map ? userTopics.get(k) : userTopics[k]
  let sum = 0
  for (const t of topics) sum += Math.max(0, get(t) ?? 0)
  // squash: 0..~25 affinity → 0..1
  return clamp01(sum / 12)
}

/**
 * Per-user relevance score used to rank a candidate for a specific feed request.
 * Combines global quality + personal affinity + creator credibility + proximity,
 * scaled by distribution stage, with a penalty if already seen.
 */
export function relevanceScore(params: {
  base: number                      // contentQualityScore
  stats: StatsView
  cfg: IRankingConfig
  userTopics?: Record<string, number> | Map<string, number>
  creatorAffinity?: number          // user's affinity to this creator (0..~25)
  creatorCredibility?: number       // global CreatorScore.credibility (0..1)
  sameRegion?: boolean
  seen?: boolean
  explorationBoost?: number         // ε-greedy / cold-start injection
}): number {
  const { base, stats, cfg, userTopics, creatorAffinity = 0, creatorCredibility = 0, sameRegion, seen, explorationBoost = 0 } = params
  const w = cfg.weights

  const match = interestMatch(stats.topics, userTopics) * w.interestMatch
  const creatorAff = clamp01(creatorAffinity / 12) * w.interestMatch * 0.5
  const cred = creatorCredibility * w.creatorCredibility
  const prox = sameRegion ? w.proximity : 0

  let s = (base + match + creatorAff + cred + prox) * STAGE_MULT[stats.stage]
  s += explorationBoost
  if (seen) s *= 0.15
  return s
}

export { STAGE_MULT }
