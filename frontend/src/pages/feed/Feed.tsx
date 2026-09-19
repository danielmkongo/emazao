import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, Sprout } from 'lucide-react'
import { PostCard } from '@/components/feed/PostCard'
import { SuggestedFarmers } from '@/components/feed/SuggestedFarmers'
import { StoriesRail } from '@/components/stories/StoriesRail'
import { useStoryFeed } from '@/lib/stories'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import type { FeedItem, Product, Reel, User } from '@/types'

const TABS = [
  { value: 'trending', label: 'feed.forYou' },
  { value: 'latest',   label: 'feed.latest' },
  { value: 'nearby',   label: 'feed.nearby' },
] as const

function PostSkeleton() {
  return (
    <div className="md:border md:border-[var(--c-border)] md:rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className="w-[34px] h-[34px] rounded-full skeleton-shimmer" />
        <div className="space-y-1.5"><div className="h-3 w-28 rounded skeleton-shimmer" /><div className="h-2.5 w-20 rounded skeleton-shimmer" /></div>
      </div>
      <div className="aspect-[4/5] skeleton-shimmer" />
      <div className="px-3.5 py-3 space-y-2"><div className="h-3 w-24 rounded skeleton-shimmer" /><div className="h-3 w-3/4 rounded skeleton-shimmer" /></div>
    </div>
  )
}

export default function Feed() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('trending')

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed', tab],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
      const res = await api.get<{ success: boolean; data: FeedItem[]; nextCursor: string | null }>(`/feed?limit=12&sort=${tab}${cursor}`)
      return res.data
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
  const items = data?.pages.flatMap(p => p.data ?? []) ?? []

  // Authors' stories, so each post's avatar can carry its ring.
  const { data: storyGroups } = useStoryFeed()
  const storiesByUser = useMemo(() => new Map((storyGroups ?? []).map(g => [g.user._id, g])), [storyGroups])

  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !isFetchingNextPage) fetchNextPage() }, { rootMargin: '900px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="max-w-[500px] mx-auto md:pt-4 lg:pt-6">
      <StoriesRail />

      {/* Feed selector — text tabs, the way TikTok puts Following / For You */}
      <div className="flex items-center justify-center gap-6 h-11 border-b border-[var(--c-border-sub)] md:border-0 mb-0 md:mb-2" role="tablist">
        {TABS.map(({ value, label }) => (
          <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
            className={cn('relative h-full text-[15px] transition-colors', tab === value ? 'text-[var(--c-text)] font-bold' : 'text-[var(--c-text-3)] font-medium hover:text-[var(--c-text-2)]')}>
            {t(label)}
            {tab === value && <motion.span layoutId="feed-tab" className="absolute left-1/2 -translate-x-1/2 bottom-1.5 w-5 h-[3px] rounded-full bg-[var(--c-text)]" />}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:gap-5 divide-y divide-[var(--c-border-sub)] md:divide-y-0">
        {isLoading ? (
          [...Array(3)].map((_, i) => <PostSkeleton key={i} />)
        ) : items.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-16 h-16 rounded-2xl bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
              <Sprout className="h-8 w-8 text-brand-green" />
            </div>
            <p className="text-[var(--c-text)] font-semibold mb-1">{t('feed.emptyTitle')}</p>
            <p className="text-[var(--c-text-3)] text-sm">{t('feed.emptyBody')}</p>
          </div>
        ) : (
          items.map((item, i) => {
            const d = item.data as Product & Reel
            const author = (item.type === 'REEL' ? d.userId : d.sellerId) as User | undefined
            return (
              <Fragment key={`${item.type}-${d._id}`}>
                <PostCard kind={item.type} item={d} storyGroup={author ? storiesByUser.get(author._id) : null} />
                {i === 2 && <SuggestedFarmers />}
              </Fragment>
            )
          })
        )}
      </div>

      <div ref={sentinel} />
      {isFetchingNextPage && <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--c-text-3)]" /></div>}
      {!hasNextPage && items.length > 0 && (
        <div className="py-12 flex flex-col items-center text-center px-6">
          <span className="w-16 h-16 rounded-full story-ring p-[3px] mb-3">
            <span className="w-full h-full rounded-full bg-[var(--c-bg)] flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-brand-green" strokeWidth={1.8} />
            </span>
          </span>
          <p className="text-[var(--c-text)] font-semibold">{t('common.allCaughtUp')}</p>
          <p className="text-[var(--c-text-3)] text-sm mt-0.5">{t('feed.caughtUpBody')}</p>
        </div>
      )}
    </div>
  )
}
