import { useQuery } from '@tanstack/react-query'
import { Star, BadgeCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

interface Review {
  _id: string
  authorId: User
  rating: number
  title?: string
  content: string
  isVerifiedPurchase: boolean
  createdAt: string
}

interface ReviewPage {
  reviews: Review[]
  total: number
  average: number | null
  count: number
  distribution: Record<string, number>
}

export function Stars({ value, size = 'h-3.5 w-3.5' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`${size} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-[var(--c-border)]'}`}
        />
      ))}
    </span>
  )
}

/**
 * A seller's reviews, with the full distribution rather than only an average —
 * four fives and a one is a different seller from five fours, and both average
 * 4.2. Every review here came from a delivered order, so "Verified purchase" is
 * a fact about the order rather than a claim by the reviewer.
 */
export function SellerReviews({ sellerId }: { sellerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-reviews', sellerId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ReviewPage>>(`/reviews/seller/${sellerId}`)
      return res.data.data
    },
    enabled: Boolean(sellerId),
  })

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />
  if (!data) return null

  if (data.count === 0) {
    return (
      <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-5 text-center">
        <p className="text-[var(--c-text)] font-semibold">No reviews yet</p>
        <p className="text-[var(--c-text-3)] text-sm mt-1">
          Reviews appear here once buyers have received an order from this seller.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row gap-6 mb-5">
        <div className="shrink-0 text-center sm:text-left">
          <p className="text-4xl font-bold text-[var(--c-text)] tabular-nums leading-none">{data.average?.toFixed(1)}</p>
          <div className="mt-2"><Stars value={data.average ?? 0} size="h-4 w-4" /></div>
          <p className="text-[var(--c-text-3)] text-xs mt-1.5">{data.count} review{data.count !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex-1 space-y-1.5 min-w-0">
          {[5, 4, 3, 2, 1].map(n => {
            const c = data.distribution[n] ?? 0
            return (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="text-[var(--c-text-3)] w-3 tabular-nums">{n}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                <div className="flex-1 h-2 bg-[var(--c-raised)] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${data.count ? (c / data.count) * 100 : 0}%` }} />
                </div>
                <span className="text-[var(--c-text-3)] w-6 text-right tabular-nums">{c}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="divide-y divide-[var(--c-border)]">
        {data.reviews.map(r => (
          <div key={r._id} className="py-4 first:pt-0">
            <div className="flex items-center gap-2.5 mb-2">
              <Avatar src={r.authorId?.avatar} name={r.authorId?.name ?? 'Buyer'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[var(--c-text)] text-sm font-medium truncate">{r.authorId?.name ?? 'Buyer'}</p>
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} size="h-3 w-3" />
                  <span className="text-[var(--c-text-4)] text-[11px]">{timeAgo(r.createdAt)}</span>
                </div>
              </div>
              {r.isVerifiedPurchase && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-green shrink-0">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified purchase
                </span>
              )}
            </div>
            {r.title && <p className="text-[var(--c-text)] text-sm font-semibold mb-0.5">{r.title}</p>}
            <p className="text-[var(--c-text-2)] text-sm leading-relaxed">{r.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
