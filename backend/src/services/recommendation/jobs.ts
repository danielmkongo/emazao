import ContentStats, { DistributionStage } from '../../models/ContentStats'
import { getRankingConfig } from './config'
import { contentQualityScore, statsViewFrom } from './ranking'
import { recomputeCreatorScores } from './creatorScore'

/**
 * Background workers for the recommendation engine.
 *
 * Run in-process on intervals today (startRecommendationJobs). At scale these
 * become queue consumers / cron workers in a separate process — the logic is
 * unchanged, only the trigger differs.
 */

const STAGE_ORDER: DistributionStage[] = ['SUPPRESSED', 'TEST', 'EXPANSION', 'BROAD', 'VIRAL']

/**
 * Re-score recently active content and move it through distribution stages.
 * A piece of content only changes stage once it has a minimum impression sample,
 * so decisions are statistically meaningful (Stage 1→2→3→4 of the spec).
 */
export async function scoreAndPromote(batchLimit = 500): Promise<number> {
  const cfg = await getRankingConfig()
  const th = cfg.stageThresholds

  // Content touched since last scoring, oldest-scored first
  const rows = await ContentStats.find({
    lastEventAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) },
  }).sort({ scoreUpdatedAt: 1 }).limit(batchLimit)

  let updated = 0
  for (const s of rows) {
    const view = statsViewFrom(s)
    const score = contentQualityScore(view, cfg)
    let stage = s.stage

    if (s.stage !== 'VIRAL') {                 // viral is owned by the viral detector
      if (s.impressions >= th.minImpressions) {
        if (score < th.suppressBelow) stage = 'SUPPRESSED'
        else if (score >= th.broadToViral) stage = 'BROAD'      // viral detector elevates further
        else if (score >= th.expansionToBroad) stage = 'BROAD'
        else if (score >= th.testToExpansion) stage = 'EXPANSION'
        else stage = 'TEST'
      }
      // recovery: a suppressed item that improved can climb back
      if (s.stage === 'SUPPRESSED' && score >= th.testToExpansion && s.quality === 'OK') stage = 'EXPANSION'
    }

    const set: any = { score, scoreUpdatedAt: new Date() }
    if (stage !== s.stage) { set.stage = stage; set.stageUpdatedAt = new Date() }
    await ContentStats.updateOne({ _id: s._id }, { $set: set })
    updated++
  }
  return updated
}

/**
 * Viral detection — velocity over a short rolling window. Content with unusually
 * high share/save/follow velocity AND strong completion is amplified to VIRAL and
 * the window is reset so velocity is measured fresh each cycle.
 */
export async function detectViral(): Promise<number> {
  const cfg = await getRankingConfig()
  const v = cfg.viral
  const windowStart = new Date(Date.now() - v.windowMinutes * 60 * 1000)

  const rows = await ContentStats.find({
    stage: { $in: ['BROAD', 'EXPANSION'] },
    'window.impressions': { $gte: v.minImpressions },
    'window.since': { $gte: windowStart },
  }).limit(500)

  let promoted = 0
  for (const s of rows) {
    const imp = Math.max(s.window.impressions, 1)
    const shareVel = s.window.shares / imp
    const saveVel = s.window.saves / imp
    const followVel = s.window.follows / imp
    const completion = s.completes / Math.max(s.viewStarts, 1)

    const isViral =
      completion >= v.completionRate &&
      (shareVel >= v.shareVelocity || saveVel >= v.saveVelocity || followVel >= v.followVelocity)

    if (isViral) {
      await ContentStats.updateOne({ _id: s._id }, {
        $set: { stage: 'VIRAL', stageUpdatedAt: new Date() },
      })
      promoted++
    }
  }
  // Reset velocity windows so the next cycle measures fresh momentum
  await ContentStats.updateMany(
    { 'window.since': { $lt: windowStart } },
    { $set: { 'window.since': new Date(), 'window.impressions': 0, 'window.completes': 0, 'window.shares': 0, 'window.saves': 0, 'window.follows': 0 } }
  )
  return promoted
}

/**
 * Quality protection — suppress content with heavy skipping or poor retention,
 * and flag engagement-bait / suspicious patterns (e.g. likes far exceeding
 * watch, or impossible engagement-to-reach ratios suggesting manipulation).
 */
export async function qualityGuard(): Promise<number> {
  const cfg = await getRankingConfig()
  const q = cfg.quality

  const rows = await ContentStats.find({
    impressions: { $gte: q.minImpressions },
    stage: { $ne: 'SUPPRESSED' },
  }).limit(1000)

  let flagged = 0
  for (const s of rows) {
    const imp = Math.max(s.impressions, 1)
    const vs = Math.max(s.viewStarts, 1)
    const skipRate = s.skips / imp
    const completion = s.completes / vs
    const likeToView = s.likes / vs

    let quality: typeof s.quality = 'OK'
    if (likeToView > 3 || s.shares > s.impressions) quality = 'SUSPICIOUS'      // impossible ratios
    else if (s.likes > 0 && completion < 0.05 && likeToView > 1.5) quality = 'ENGAGEMENT_BAIT'
    else if (skipRate > q.maxSkipRate || completion < q.minCompletionRate) quality = 'LOW_RETENTION'

    if (quality !== s.quality) {
      const set: any = { quality }
      if (quality === 'SUSPICIOUS') { set.stage = 'SUPPRESSED'; set.stageUpdatedAt = new Date() }
      await ContentStats.updateOne({ _id: s._id }, { $set: set })
      flagged++
    }
  }
  return flagged
}

let timers: ReturnType<typeof setInterval>[] = []

/** Wire up the interval workers. Called once from app startup. */
export function startRecommendationJobs(): void {
  const run = (fn: () => Promise<unknown>, label: string) => fn().catch(e => console.error(`[rec:${label}]`, (e as Error).message))

  // Stagger so they don't all fire together
  timers.push(setInterval(() => run(scoreAndPromote, 'score'), 60_000))            // every 1 min
  timers.push(setInterval(() => run(detectViral, 'viral'), 90_000))                // every 1.5 min
  timers.push(setInterval(() => run(qualityGuard, 'quality'), 300_000))            // every 5 min
  timers.push(setInterval(() => run(recomputeCreatorScores, 'creators'), 600_000)) // every 10 min

  // Kick once shortly after boot
  setTimeout(() => run(scoreAndPromote, 'score:boot'), 15_000)
  setTimeout(() => run(recomputeCreatorScores, 'creators:boot'), 30_000)
  console.log('🧠 Recommendation jobs started (score / viral / quality / creators)')
}

export function stopRecommendationJobs(): void {
  timers.forEach(clearInterval)
  timers = []
}
