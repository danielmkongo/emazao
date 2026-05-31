import ContentStats from '../../models/ContentStats'
import CreatorScore from '../../models/CreatorScore'
import SellerProfile from '../../models/SellerProfile'

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/**
 * Recompute creator credibility from REAL measured outcomes — content
 * performance + commerce trust — not vanity follower counts. Powers the
 * "Top Farmers" leaderboard and feeds content ranking (creatorCredibility).
 */
export async function recomputeCreatorScores(): Promise<number> {
  // Aggregate content performance per creator
  const agg = await ContentStats.aggregate([
    {
      $group: {
        _id: '$creatorId',
        impressions: { $sum: '$impressions' },
        viewStarts: { $sum: '$viewStarts' },
        completes: { $sum: '$completes' },
        engagements: { $sum: { $add: ['$likes', '$saves', '$shares', '$comments'] } },
        follows: { $sum: '$followsGenerated' },
        profileVisits: { $sum: '$profileVisits' },
        lastEventAt: { $max: '$lastEventAt' },
        contentCount: { $sum: 1 },
      },
    },
  ])

  if (agg.length === 0) return 0

  // Commerce trust signals
  const creatorIds = agg.map(a => a._id)
  const profiles = await SellerProfile.find({ userId: { $in: creatorIds } })
    .select('userId rating totalSales onTimeDelivery').lean()
  const profMap = new Map(profiles.map((p: any) => [p.userId.toString(), p]))

  // Normalization references (relative to the top performer this cycle)
  const maxReach = Math.max(...agg.map(a => a.impressions), 1)
  const maxSales = Math.max(...agg.map(a => (profMap.get(a._id.toString())?.totalSales ?? 0)), 1)

  const computed = agg.map(a => {
    const vs = Math.max(a.viewStarts, 1)
    const imp = Math.max(a.impressions, 1)
    const completion = clamp01(a.completes / vs)
    const engagement = clamp01(a.engagements / imp / 0.3)          // 30% eng rate = full marks
    const followConv = clamp01(a.follows / Math.max(a.profileVisits, 1) / 0.2)
    const reach = clamp01(a.impressions / maxReach)

    const prof = profMap.get(a._id.toString())
    const rating = clamp01((prof?.rating ?? 0) / 5)
    const sales = clamp01((prof?.totalSales ?? 0) / maxSales)
    const onTime = clamp01((prof?.onTimeDelivery ?? 0) / 100)

    const daysSince = a.lastEventAt ? (Date.now() - new Date(a.lastEventAt).getTime()) / 86_400_000 : 999
    const consistency = clamp01(1 / (1 + daysSince / 7))           // active in last week ≈ high

    const credibility =
      completion * 0.24 +
      engagement * 0.18 +
      followConv * 0.14 +
      reach * 0.08 +
      rating * 0.16 +
      sales * 0.10 +
      onTime * 0.05 +
      consistency * 0.05

    return {
      creatorId: a._id,
      avgCompletionRate: completion,
      avgEngagementRate: engagement,
      totalReach: a.impressions,
      followsGenerated: a.follows,
      followConversion: followConv,
      salesCount: prof?.totalSales ?? 0,
      rating: prof?.rating ?? 0,
      onTimeDelivery: prof?.onTimeDelivery ?? 0,
      consistency,
      credibility,
    }
  })

  // Rank by credibility
  computed.sort((a, b) => b.credibility - a.credibility)

  const ops = computed.map((c, i) => ({
    updateOne: {
      filter: { creatorId: c.creatorId },
      update: { $set: { ...c, rank: i + 1, scoreUpdatedAt: new Date() } },
      upsert: true,
    },
  })) as any[]

  await CreatorScore.bulkWrite(ops, { ordered: false })
  return computed.length
}
