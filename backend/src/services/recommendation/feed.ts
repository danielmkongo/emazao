import Reel from '../../models/Reel'
import Product from '../../models/Product'
import Follow from '../../models/Follow'
import ContentStats from '../../models/ContentStats'
import UserInterest from '../../models/UserInterest'
import FeedImpression from '../../models/FeedImpression'
import CreatorScore from '../../models/CreatorScore'
import User from '../../models/User'
import Like from '../../models/Like'
import Save from '../../models/Save'
import { getRankingConfig } from './config'
import {
  contentQualityScore, relevanceScore, statsViewFrom, emptyStatsView, type StatsView,
} from './ranking'
import { queueImpressions } from './signals'
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

// The candidate pool is re-scored (with randomized exploration and constantly
// arriving new content) on every call, so slicing a fresh `diversified` array
// by numeric offset on each page request duplicates/skips items as the
// underlying order shifts between requests — a classic offset-pagination
// footgun made worse by the scoring being non-deterministic. Freezing the
// ordering for a short window per (user, sort) fixes that without touching
// the scoring/diversity logic itself: the first request (offset 0) computes
// and caches the order; subsequent pages in the same browsing session slice
// from that same frozen list instead of a freshly reshuffled one.
const FEED_ORDER_CACHE_TTL_MS = 3 * 60 * 1000
const feedOrderCache = new Map<string, { items: { c: Candidate; score: number }[]; expiresAt: number }>()

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
 * The part of the feed that is the same for everyone: the newest reels and
 * products, what is trending, and the stats and creator scores the ranking
 * reads. Only follows, interests, what you have already seen and your own
 * likes are personal — so this is built once, kept for POOL_TTL_MS, and shared.
 *
 * It used to be rebuilt on every request: two populated queries of 80 rows,
 * the trending set, then stats and credibility for all 160, each row turned
 * into a full Mongoose document. That was ~300 ms of work per feed load with
 * a realistic amount of content, identical for every visitor. Rows are plain
 * objects now too; nothing downstream needed them to be documents.
 *
 * Concurrent requests during a rebuild wait on the same promise rather than
 * each starting their own, so a cold cache under load costs one build, not
 * one per waiting visitor.
 */
interface Pool {
  candidates: Candidate[]
  statsMap: Map<string, StatsView>
  credMap: Map<string, number>
}
const POOL_TTL_MS = 30_000
const pools = new Map<string, { value?: Pool; expires: number; building?: Promise<Pool> }>()

async function candidatePool(size: number, trendingLimit: number): Promise<Pool> {
  const key = `${size}:${trendingLimit}`
  const slot = pools.get(key)
  if (slot?.value && slot.expires > Date.now()) return slot.value
  if (slot?.building) return slot.building

  const building = (async (): Promise<Pool> => {
    const [recentReels, recentProducts, trending] = await Promise.all([
      Reel.find({ status: 'PUBLISHED' }).populate('userId', 'name username avatar isVerified country region').populate('productId', 'title price priceUnit images slug').sort({ createdAt: -1 }).limit(size).lean(),
      Product.find({ status: 'ACTIVE' }).populate('sellerId', 'name username avatar isVerified country region').populate('categoryId', 'name slug').sort({ createdAt: -1 }).limit(size).lean(),
      ContentStats.find({ stage: { $in: ['BROAD', 'VIRAL'] }, quality: { $ne: 'SUSPICIOUS' } }).sort({ score: -1 }).limit(trendingLimit).select('contentId contentType').lean(),
    ])

    const candMap = new Map<string, Candidate>()
    for (const r of recentReels) candMap.set(r._id.toString(), toCand(r, 'REEL'))
    for (const p of recentProducts) candMap.set(p._id.toString(), toCand(p, 'PRODUCT'))

    // Trending items not already among the newest.
    const missingReelIds = trending.filter(t => t.contentType === 'REEL' && !candMap.has(t.contentId.toString())).map(t => t.contentId)
    const missingProdIds = trending.filter(t => t.contentType === 'PRODUCT' && !candMap.has(t.contentId.toString())).map(t => t.contentId)
    if (missingReelIds.length || missingProdIds.length) {
      const [tReels, tProds] = await Promise.all([
        missingReelIds.length ? Reel.find({ _id: { $in: missingReelIds }, status: 'PUBLISHED' }).populate('userId', 'name username avatar isVerified country region').populate('productId', 'title price priceUnit images slug').lean() : [],
        missingProdIds.length ? Product.find({ _id: { $in: missingProdIds }, status: 'ACTIVE' }).populate('sellerId', 'name username avatar isVerified country region').populate('categoryId', 'name slug').lean() : [],
      ])
      for (const r of tReels) candMap.set(r._id.toString(), toCand(r, 'REEL'))
      for (const p of tProds) candMap.set(p._id.toString(), toCand(p, 'PRODUCT'))
    }

    const candidates = [...candMap.values()]
    const ids = candidates.map(c => c.id)
    const creatorIds = [...new Set(candidates.map(c => c.creatorId).filter(Boolean))]
    const [statsRows, credRows] = candidates.length
      ? await Promise.all([
          ContentStats.find({ contentId: { $in: ids } }).lean(),
          CreatorScore.find({ creatorId: { $in: creatorIds } }).select('creatorId credibility').lean(),
        ])
      : [[], []]
    return {
      candidates,
      statsMap: new Map<string, StatsView>(statsRows.map((s: any) => [s.contentId.toString(), statsViewFrom(s)])),
      credMap: new Map<string, number>(credRows.map((c: any) => [c.creatorId.toString(), c.credibility])),
    }
  })()

  pools.set(key, { value: slot?.value, expires: slot?.expires ?? 0, building })
  try {
    const value = await building
    pools.set(key, { value, expires: Date.now() + POOL_TTL_MS })
    return value
  } catch (err) {
    // Keep serving the last good pool if a rebuild fails.
    pools.set(key, { value: slot?.value, expires: slot?.expires ?? 0 })
    if (slot?.value) return slot.value
    throw err
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

  // ── Shared: the candidates everyone ranks from (see candidatePool) ──────
  const { candidates, statsMap, credMap } = await candidatePool(pool, limit * 2)
  if (candidates.length === 0) return []

  // ── Personal: small, indexed lookups for this viewer only ─────────────────
  const ids = candidates.map(c => c.id)
  const [interest, follows, me, seenRows] = await Promise.all([
    userId ? UserInterest.findOne({ userId }).lean() : null,
    userId ? Follow.find({ followerId: userId }).select('followingId').lean() : [],
    userId ? User.findById(userId).select('region').lean() : null,
    userId ? FeedImpression.find({ userId, contentId: { $in: ids } }).select('contentId').lean() : [],
  ])
  const seen = new Set(seenRows.map((s: any) => s.contentId.toString()))
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
      creatorAffinity: userCreators instanceof Map
        ? (userCreators.get(c.creatorId) ?? 0)
        : ((userCreators as Record<string, number> | undefined)?.[c.creatorId] ?? 0),
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

  // ── Freeze the order for this browsing session (see comment above) ────────
  const cacheKey = userId ? `${userId}:${sort}` : null
  let ordered = diversified
  if (cacheKey) {
    const cached = feedOrderCache.get(cacheKey)
    if (offset === 0 || !cached || cached.expiresAt < Date.now()) {
      feedOrderCache.set(cacheKey, { items: diversified, expiresAt: Date.now() + FEED_ORDER_CACHE_TTL_MS })
      // Opportunistic sweep so this Map can't grow unbounded across sessions —
      // cheap relative to the rest of this function's DB work, and avoids
      // needing a separate interval/timer for what's a low-value cache.
      if (feedOrderCache.size > 500) {
        const now = Date.now()
        for (const [k, v] of feedOrderCache) if (v.expiresAt < now) feedOrderCache.delete(k)
      }
    } else {
      ordered = cached.items
    }
  }

  // ── Paginate ──────────────────────────────────────────────────────────────
  const page = ordered.slice(offset, offset + limit)

  // ── Record impressions (fire-and-forget) so TEST content accrues a sample ──
  if (userId) void recordImpressions(userId, page.map(p => p.c))

  // ── Attach this viewer's own like/save state ──────────────────────────────
  // The feed previously returned no per-viewer social state, so cards rendered
  // as un-liked regardless of history. The first tap then sent a *toggle*, which
  // removed an already-existing like while the icon lit up — the control did the
  // opposite of what it displayed, and the count drifted. Two bulk queries for
  // the page rather than a lookup per card.
  let likedIds = new Set<string>()
  let savedIds = new Set<string>()
  if (userId && page.length) {
    const pageIds = page.map(p => p.c.id)
    const [likes, saves] = await Promise.all([
      Like.find({ userId, targetId: { $in: pageIds } }).select('targetId').lean(),
      Save.find({ userId, targetId: { $in: pageIds } }).select('targetId').lean(),
    ])
    likedIds = new Set(likes.map((l: any) => l.targetId.toString()))
    savedIds = new Set(saves.map((s: any) => s.targetId.toString()))
  }

  return page.map(({ c, score }) => {
    // c.doc is a hydrated Mongoose document; an off-schema field assigned to it
    // would be dropped by toJSON(), so serialize first and extend the result.
    const data = typeof c.doc?.toObject === 'function' ? c.doc.toObject() : { ...c.doc }
    data.userLiked = likedIds.has(c.id)
    data.userSaved = savedIds.has(c.id)
    return { type: c.type, score, data, createdAt: c.createdAt }
  })
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

/** Queued, not written: see queueImpressions for why the writes are batched. */
function recordImpressions(userId: string, cands: Candidate[]) {
  queueImpressions(userId, cands.map(c => ({ contentId: c.id, contentType: c.type, creatorId: c.creatorId || undefined })))
}

// Minimal structural type so diversify() doesn't import the full Mongoose doc type
interface IRankingConfigLike {
  diversity: { maxConsecutiveSameCreator: number; maxPerCreatorPerPage: number; maxPerTopicPerPage: number }
}
