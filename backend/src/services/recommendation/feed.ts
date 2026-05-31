import Reel from '../../models/Reel'
import Product from '../../models/Product'
import Follow from '../../models/Follow'
import ContentStats from '../../models/ContentStats'
import UserInterest from '../../models/UserInterest'
import FeedImpression from '../../models/FeedImpression'
import CreatorScore from '../../models/CreatorScore'
import User from '../../models/User'
import { getRankingConfig } from './config'
import {
  contentQualityScore, relevanceScore, statsViewFrom, emptyStatsView, type StatsView,
} from './ranking'
import { recordInteraction } from './signals'
import type { ContentType } from '../../models/InteractionEvent'

export interface FeedItem {
  type: ContentType
  score: number
  data: unknown
  createdAt: Date
}

interface Candidate {
  id: string
  type: ContentType
  doc: any
  createdAt: Date
  creatorId: string
  topics: string[]
}

const toCand = (doc: any, type: ContentType): Candidate => {
  const creator = type === 'REEL' ? doc.userId : doc.sellerId
  const creatorId = (creator?._id ?? creator)?.toString?.() ?? ''
  return {
    id: doc._id.toString(),
    type,
    doc,
    createdAt: doc.createdAt,
    creatorId,
    topics: doc.tags ?? [],
  }
}

/**
 * Personalized, multi-source feed.
 *   retrieve → score → diversify → paginate → record impressions
 * Works from day one (legacy content with no ContentStats is scored on freshness),
 * and gets sharper as signals accumulate.
 */
export async function buildFeed(userId?: string, cursor?: string, limit = 20, sort = 'trending'): Promise<FeedItem[]> {
  const cfg = await getRankingConfig()
  const offset = Math.max(0, parseInt(cursor ?? '0', 10) || 0)
  const pool = limit * 4

  // ── Parallel context loads ────────────────────────────────────────────────
  const [recentReels, recentProducts, trending, interest, follows, me] = await Promise.all([
    Reel.find({ status: 'PUBLISHED' }).populate('userId', 'name username avatar isVerified country region').populate('productId', 'title price priceUnit images slug').sort({ createdAt: -1 }).limit(pool),
    Product.find({ status: 'ACTIVE' }).populate('sellerId', 'name username avatar isVerified country region').populate('categoryId', 'name slug').sort({ createdAt: -1 }).limit(pool),
    ContentStats.find({ stage: { $in: ['BROAD', 'VIRAL'] }, quality: { $ne: 'SUSPICIOUS' } }).sort({ score: -1 }).limit(limit * 2).select('contentId contentType'),
    userId ? UserInterest.findOne({ userId }) : null,
    userId ? Follow.find({ followerId: userId }).select('followingId').lean() : [],
    userId ? User.findById(userId).select('region') : null,
  ])

  // ── Assemble candidate docs (dedupe by id) ────────────────────────────────
  const candMap = new Map<string, Candidate>()
  for (const r of recentReels) candMap.set(r._id.toString(), toCand(r, 'REEL'))
  for (const p of recentProducts) candMap.set(p._id.toString(), toCand(p, 'PRODUCT'))

  // Hydrate trending items not already in the pool
  const missingReelIds = trending.filter(t => t.contentType === 'REEL' && !candMap.has(t.contentId.toString())).map(t => t.contentId)
  const missingProdIds = trending.filter(t => t.contentType === 'PRODUCT' && !candMap.has(t.contentId.toString())).map(t => t.contentId)
  if (missingReelIds.length || missingProdIds.length) {
    const [tReels, tProds] = await Promise.all([
      missingReelIds.length ? Reel.find({ _id: { $in: missingReelIds }, status: 'PUBLISHED' }).populate('userId', 'name username avatar isVerified country region').populate('productId', 'title price priceUnit images slug') : [],
      missingProdIds.length ? Product.find({ _id: { $in: missingProdIds }, status: 'ACTIVE' }).populate('sellerId', 'name username avatar isVerified country region').populate('categoryId', 'name slug') : [],
    ])
    for (const r of tReels) candMap.set(r._id.toString(), toCand(r, 'REEL'))
    for (const p of tProds) candMap.set(p._id.toString(), toCand(p, 'PRODUCT'))
  }

  const candidates = [...candMap.values()]
  if (candidates.length === 0) return []

  // ── Batch-load stats, seen-set, creator credibility ───────────────────────
  const ids = candidates.map(c => c.id)
  const creatorIds = [...new Set(candidates.map(c => c.creatorId).filter(Boolean))]
  const [statsRows, seenRows, credRows] = await Promise.all([
    ContentStats.find({ contentId: { $in: ids } }),
    userId ? FeedImpression.find({ userId, contentId: { $in: ids } }).select('contentId').lean() : [],
    CreatorScore.find({ creatorId: { $in: creatorIds } }).select('creatorId credibility').lean(),
  ])
  const statsMap = new Map<string, StatsView>(statsRows.map(s => [s.contentId.toString(), statsViewFrom(s)]))
  const seen = new Set(seenRows.map((s: any) => s.contentId.toString()))
  const credMap = new Map<string, number>(credRows.map((c: any) => [c.creatorId.toString(), c.credibility]))
  const followed = new Set((follows as any[]).map(f => f.followingId.toString()))
  const userRegion = (me as any)?.region
  const userTopics = interest?.topics
  const userCreators = interest?.creators

  // ── Score every candidate ─────────────────────────────────────────────────
  const scored = candidates.map(c => {
    const stats = statsMap.get(c.id) ?? emptyStatsView(c.createdAt, c.topics, c.creatorId)
    const base = contentQualityScore(stats, cfg)
    const itemRegion = c.type === 'REEL' ? c.doc.userId?.region : c.doc.sellerId?.region
    // Cold-start injection: new TEST content under the impression target gets a boost
    const coldStart = stats.stage === 'TEST' && stats.impressions < cfg.coldStart.targetImpressions ? cfg.coldStart.injectionBoost : 0
    // ε-greedy exploration so the feed isn't a filter bubble
    const explore = Math.random() < cfg.exploration.epsilon ? Math.random() * 0.15 : 0
    const followBoost = followed.has(c.creatorId) ? 0.12 : 0

    const score = relevanceScore({
      base, stats, cfg,
      userTopics,
      creatorAffinity: userCreators instanceof Map ? (userCreators.get(c.creatorId) ?? 0) : 0,
      creatorCredibility: credMap.get(c.creatorId) ?? 0,
      sameRegion: !!userRegion && itemRegion === userRegion,
      seen: seen.has(c.id),
      explorationBoost: coldStart + explore + followBoost,
    })
    return { c, score }
  })

  // ── Sort ──────────────────────────────────────────────────────────────────
  if (sort === 'latest') scored.sort((a, b) => b.c.createdAt.getTime() - a.c.createdAt.getTime())
  else scored.sort((a, b) => b.score - a.score)

  // ── Diversity: cap consecutive same-creator + per-creator/topic per page ──
  const diversified = diversify(scored, cfg)

  // ── Paginate ──────────────────────────────────────────────────────────────
  const page = diversified.slice(offset, offset + limit)

  // ── Record impressions (fire-and-forget) so TEST content accrues a sample ──
  if (userId) void recordImpressions(userId, page.map(p => p.c))

  return page.map(({ c, score }) => ({ type: c.type, score, data: c.doc, createdAt: c.createdAt }))
}

function diversify(scored: { c: Candidate; score: number }[], cfg: IRankingConfigLike): { c: Candidate; score: number }[] {
  const { maxConsecutiveSameCreator, maxPerCreatorPerPage, maxPerTopicPerPage } = cfg.diversity
  const out: { c: Candidate; score: number }[] = []
  const creatorCount = new Map<string, number>()
  const topicCount = new Map<string, number>()
  const pool = [...scored]

  while (pool.length && out.length < scored.length) {
    let picked = -1
    for (let i = 0; i < pool.length; i++) {
      const cand = pool[i]!.c
      const cCount = creatorCount.get(cand.creatorId) ?? 0
      if (cCount >= maxPerCreatorPerPage) continue
      const last = out[out.length - 1]?.c
      const lastN = out.slice(-maxConsecutiveSameCreator).every(o => o.c.creatorId === cand.creatorId)
      if (last && lastN && out.length >= maxConsecutiveSameCreator && cand.creatorId === last.creatorId) continue
      const topicOver = cand.topics.some(t => (topicCount.get(t) ?? 0) >= maxPerTopicPerPage)
      if (topicOver) continue
      picked = i
      break
    }
    if (picked === -1) picked = 0   // relax constraints if nothing qualifies
    const chosen = pool.splice(picked, 1)[0]!
    out.push(chosen)
    creatorCount.set(chosen.c.creatorId, (creatorCount.get(chosen.c.creatorId) ?? 0) + 1)
    for (const t of chosen.c.topics) topicCount.set(t, (topicCount.get(t) ?? 0) + 1)
  }
  return out
}

async function recordImpressions(userId: string, cands: Candidate[]) {
  try {
    const ops = cands.map(c => ({
      updateOne: {
        filter: { userId, contentId: c.id },
        update: { $setOnInsert: { userId, contentId: c.id, contentType: c.type, createdAt: new Date() } },
        upsert: true,
      },
    })) as any[]
    await FeedImpression.bulkWrite(ops, { ordered: false })
    for (const c of cands) {
      void recordInteraction({ userId, contentId: c.id, contentType: c.type, creatorId: c.creatorId, event: 'impression', source: 'feed' })
    }
  } catch { /* impression loss is non-fatal */ }
}

// Minimal structural type so diversify() doesn't import the full Mongoose doc type
interface IRankingConfigLike {
  diversity: { maxConsecutiveSameCreator: number; maxPerCreatorPerPage: number; maxPerTopicPerPage: number }
}
