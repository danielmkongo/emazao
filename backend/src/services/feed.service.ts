import Product from '../models/Product'
import Reel from '../models/Reel'
import Follow from '../models/Follow'

interface FeedItem {
  type: 'PRODUCT' | 'REEL'
  score: number
  data: unknown
  createdAt: Date
}

const computeScore = (params: {
  createdAt: Date
  likeCount: number
  viewCount: number
  saveCount?: number
  commentCount?: number
  shareCount?: number
  isVerified: boolean
  isBoosted: boolean
  userRegion?: string
  itemRegion?: string
  userTagOverlap: number
}) => {
  const hoursOld = (Date.now() - params.createdAt.getTime()) / 3_600_000
  const recency = 1 / (1 + hoursOld / 24)
 
  const engagementNumerator =
    params.likeCount +
    (params.saveCount ?? 0) * 2 +
    (params.commentCount ?? 0) * 3 +
    (params.shareCount ?? 0) * 4
  const engagement = params.viewCount > 0 ? engagementNumerator / params.viewCount : 0

  const personalization = Math.min(params.userTagOverlap / 5, 1)
  const verified = params.isVerified ? 0.1 : 0
  const boost = params.isBoosted ? 0.1 : 0
  const proximity = params.userRegion && params.itemRegion === params.userRegion ? 0.05 : 0

  return recency * 0.2 + engagement * 0.25 + personalization * 0.3 + verified + boost + proximity
}

export const buildFeed = async (userId?: string, cursor?: string, limit = 20, sort = 'trending'): Promise<FeedItem[]> => {
  const [products, reels] = await Promise.all([
    Product.find({ status: 'ACTIVE' })
      .populate('sellerId', 'name username avatar isVerified country region')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 3),
    Reel.find({ status: 'PUBLISHED' })
      .populate('userId', 'name username avatar isVerified country region')
      .sort({ createdAt: -1 })
      .limit(limit * 3),
  ])

  const feedItems: FeedItem[] = []

  for (const p of products) {
    const seller = p.sellerId as { isVerified?: boolean; region?: string }
    feedItems.push({
      type: 'PRODUCT',
      score: computeScore({
        createdAt: p.createdAt,
        likeCount: p.likeCount,
        viewCount: p.viewCount,
        saveCount: p.saveCount,
        isVerified: seller?.isVerified ?? false,
        isBoosted: p.isBoosted,
        itemRegion: seller?.region,
        userTagOverlap: 0,
      }),
      data: p,
      createdAt: p.createdAt,
    })
  }

  for (const r of reels) {
    const author = r.userId as { isVerified?: boolean; region?: string }
    feedItems.push({
      type: 'REEL',
      score: computeScore({
        createdAt: r.createdAt,
        likeCount: r.likeCount,
        viewCount: r.viewCount,
        commentCount: r.commentCount,
        shareCount: r.shareCount,
        isVerified: author?.isVerified ?? false,
        isBoosted: r.isBoosted,
        itemRegion: author?.region,
        userTagOverlap: 0,
      }),
      data: r,
      createdAt: r.createdAt,
    })
  }

  if (sort === 'latest') {
    feedItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } else if (sort === 'nearby') {
    // Prioritize items from the same region first, then fall back to score
    feedItems.sort((a, b) => {
      const aData = a.data as { sellerId?: { region?: string }; userId?: { region?: string } }
      const bData = b.data as { sellerId?: { region?: string }; userId?: { region?: string } }
      const aRegion = (aData.sellerId as any)?.region || (aData.userId as any)?.region
      const bRegion = (bData.sellerId as any)?.region || (bData.userId as any)?.region
      const sameA = aRegion && aRegion === (b as any).__userRegion ? 1 : 0
      const sameB = bRegion && bRegion === (a as any).__userRegion ? 1 : 0
      if (sameA !== sameB) return sameB - sameA
      return b.score - a.score
    })
  } else {
    feedItems.sort((a, b) => b.score - a.score)
  }

  // Apply cursor pagination
  let startIdx = 0
  if (cursor) {
    const cursorDate = new Date(cursor)
    startIdx = feedItems.findIndex(i => i.createdAt < cursorDate)
    if (startIdx === -1) startIdx = feedItems.length
  }

  return feedItems.slice(startIdx, startIdx + limit)
}
