import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import ContentStats from '../models/ContentStats'
import Reel from '../models/Reel'
import RankingConfig from '../models/RankingConfig'
import { getRankingConfig, invalidateRankingConfig } from '../services/recommendation/config'
import { contentQualityScore, statsViewFrom } from '../services/recommendation/ranking'

/**
 * GET /api/recommendation/content/:contentId/insights
 * Creator-facing: explains WHY a piece of content is being promoted or
 * suppressed — the full score breakdown + stage + quality flag.
 */
export const getContentInsights = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await ContentStats.findOne({ contentId: req.params['contentId'] })
    if (!stats) { res.json({ success: true, data: null, message: 'No analytics yet' }); return }

    // Owner-or-admin guard
    const isOwner = stats.creatorId.toString() === req.user?.id
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes((req.user as any)?.role ?? '')
    if (!isOwner && !isAdmin) { res.status(403).json({ success: false, message: 'Forbidden' }); return }

    const cfg = await getRankingConfig()
    const view = statsViewFrom(stats)
    const score = contentQualityScore(view, cfg)

    const vs = Math.max(stats.viewStarts, 1)
    const imp = Math.max(stats.impressions, 1)
    res.json({
      success: true,
      data: {
        stage: stats.stage,
        quality: stats.quality,
        score: Math.round(score * 1000) / 1000,
        reach: stats.impressions,
        uniqueViewers: stats.uniqueViewers,
        metrics: {
          impressions: stats.impressions,
          viewStarts: stats.viewStarts,
          completionRate: Math.round((stats.completes / vs) * 100),
          avgWatchSeconds: Math.round(stats.totalWatchMs / vs / 1000),
          shareRate: Math.round((stats.shares / imp) * 1000) / 10,
          saveRate: Math.round((stats.saves / imp) * 1000) / 10,
          skipRate: Math.round((stats.skips / imp) * 100),
          likes: stats.likes, saves: stats.saves, shares: stats.shares,
          comments: stats.comments, followsGenerated: stats.followsGenerated,
        },
        // The component contributions that produced the score (transparency)
        breakdown: {
          completion: Math.round((stats.completes / vs) * 100),
          watch: Math.round(Math.min(stats.totalWatchMs / vs / 20000, 1) * 100),
          shares: stats.shares, saves: stats.saves,
          followConversion: Math.round((stats.followsGenerated / Math.max(stats.profileVisits, 1)) * 100),
        },
        explanation: explain(stats.stage, stats.quality),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

function explain(stage: string, quality: string): string {
  if (quality === 'SUSPICIOUS') return 'Distribution paused: engagement pattern looks artificial and is under review.'
  if (quality === 'LOW_RETENTION') return 'Reduced reach: most viewers skip or drop off early. Stronger hooks and tighter edits help.'
  if (quality === 'ENGAGEMENT_BAIT') return 'Reduced reach: likes are high but watch-through is very low.'
  switch (stage) {
    case 'VIRAL': return 'Trending: exceptional share/save velocity and completion — amplified across discovery.'
    case 'BROAD': return 'Promoted: strong performance, now shown in recommendation and explore feeds.'
    case 'EXPANSION': return 'Growing: performing above the test bar, audience is being expanded.'
    case 'TEST': return 'Testing: collecting initial audience signal before wider distribution.'
    case 'SUPPRESSED': return 'Limited: performance is below the distribution threshold.'
    default: return ''
  }
}

/**
 * GET /api/recommendation/dashboard
 * Creator overview: per-content stage + score across all their content.
 */
export const getCreatorDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const creatorId = req.user!.id
    const rows = await ContentStats.find({ creatorId }).sort({ score: -1 }).limit(100).lean()
    const reelIds = rows.filter(r => r.contentType === 'REEL').map(r => r.contentId)
    const reels = await Reel.find({ _id: { $in: reelIds } }).select('title thumbnailUrl').lean()
    const reelMap = new Map(reels.map((r: any) => [r._id.toString(), r]))

    const totals = rows.reduce((acc, r) => {
      acc.impressions += r.impressions; acc.completes += r.completes
      acc.shares += r.shares; acc.saves += r.saves; acc.follows += r.followsGenerated
      return acc
    }, { impressions: 0, completes: 0, shares: 0, saves: 0, follows: 0 })

    res.json({
      success: true,
      data: {
        totals,
        content: rows.map(r => ({
          contentId: r.contentId,
          type: r.contentType,
          title: reelMap.get(r.contentId.toString())?.title ?? null,
          thumbnail: reelMap.get(r.contentId.toString())?.thumbnailUrl ?? null,
          stage: r.stage,
          quality: r.quality,
          score: Math.round(r.score * 1000) / 1000,
          impressions: r.impressions,
          completionRate: r.viewStarts ? Math.round((r.completes / r.viewStarts) * 100) : 0,
          shares: r.shares, saves: r.saves, followsGenerated: r.followsGenerated,
        })),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

/**
 * GET /api/recommendation/config  +  PUT /api/recommendation/config  [ADMIN]
 * Tune ranking weights & thresholds at runtime — no code change / redeploy.
 */
export const getConfig = async (_req: Request, res: Response): Promise<void> => {
  const cfg = await getRankingConfig()
  res.json({ success: true, data: cfg })
}

export const updateConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowed = ['weights', 'stageThresholds', 'viral', 'quality', 'exploration', 'diversity', 'coldStart', 'active']
    const updates: Record<string, unknown> = {}
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k]
    const cfg = await RankingConfig.findOneAndUpdate({ key: 'default' }, { $set: updates }, { upsert: true, new: true })
    invalidateRankingConfig()
    res.json({ success: true, data: cfg })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

/** GET /api/recommendation/admin/overview  [ADMIN] — platform distribution health. */
export const getAdminOverview = async (_req: Request, res: Response): Promise<void> => {
  try {
    const byStage = await ContentStats.aggregate([
      { $group: { _id: '$stage', count: { $sum: 1 }, impressions: { $sum: '$impressions' } } },
    ])
    const byQuality = await ContentStats.aggregate([
      { $group: { _id: '$quality', count: { $sum: 1 } } },
    ])
    const viral = await ContentStats.find({ stage: 'VIRAL' }).sort({ score: -1 }).limit(10)
      .select('contentId contentType score impressions shares saves').lean()
    res.json({ success: true, data: { byStage, byQuality, topViral: viral } })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}
