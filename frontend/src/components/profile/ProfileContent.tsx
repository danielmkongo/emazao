import { useState, useEffect, useRef } from 'react'
import { ReelThumb } from '@/components/reels/ReelThumb'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Clapperboard, Grid3x3, Bookmark, Heart, Play, Lock, Package } from 'lucide-react'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatCurrency } from '@/lib/utils'
import api from '@/lib/api'
import type { Product, Reel } from '@/types'

type Tab = 'reels' | 'posts' | 'saved' | 'liked'
type Kind = 'Reel' | 'Product'
interface Page<T> { items: T[]; next: string | number | null }

/** A reel tile, 3:4 like Instagram's grid, with the view count in the corner. */
function ReelTile({ reel }: { reel: Reel }) {
  return (
    <Link to={`/reels/${reel._id}`} state={{ reel }} className="relative block aspect-[3/4] bg-black overflow-hidden group">
      <ReelThumb thumbnailUrl={reel.thumbnailUrl} videoUrl={reel.videoUrl}
        className="absolute inset-0 w-full h-full transition-transform duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white text-xs font-semibold drop-shadow">
        <Play className="h-3.5 w-3.5 fill-white" />{formatNumber(reel.viewCount ?? 0)}
      </span>
    </Link>
  )
}

/** A product post tile, square like an Instagram post, with its price. */
function ProductTile({ product }: { product: Product }) {
  return (
    <Link to={`/marketplace/product/${product.slug ?? product._id}`} className="relative block aspect-square bg-[var(--c-raised)] overflow-hidden group">
      <ImageWithFallback src={product.images?.[0]} alt={product.title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
      <div className="absolute bottom-1.5 left-1.5 right-1.5 text-white drop-shadow">
        <p className="text-[11px] font-medium truncate leading-tight">{product.title}</p>
        <p className="text-[11px] font-bold tabular-nums">{formatCurrency(product.price)}<span className="font-normal opacity-80">/{product.priceUnit}</span></p>
      </div>
    </Link>
  )
}

function useSocialList(endpoint: 'saved' | 'liked', kind: Kind, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['profile-social', endpoint, kind],
    queryFn: async ({ pageParam }): Promise<Page<Reel | Product>> => {
      const q = new URLSearchParams({ type: kind })
      if (pageParam) q.set('cursor', String(pageParam))
      const res = await api.get<{ data: (Reel | Product)[]; nextCursor: string | null }>(`/social/${endpoint}?${q}`)
      return { items: res.data.data ?? [], next: res.data.nextCursor }
    },
    initialPageParam: null as string | null,
    getNextPageParam: last => (last.next as string | null) ?? undefined,
    enabled,
  })
}

/** Loads the next page when the sentinel scrolls into view. */
function LoadMore({ onVisible, active }: { onVisible: () => void; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active || !ref.current) return
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) onVisible() }, { rootMargin: '400px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [active, onVisible])
  return <div ref={ref} className="h-8" />
}

function Grid({ kind, items }: { kind: Kind; items: (Reel | Product)[] }) {
  return (
    <div className={`grid grid-cols-3 gap-0.5 ${kind === 'Reel' ? '' : ''}`}>
      {items.map(item => kind === 'Reel'
        ? <ReelTile key={item._id} reel={item as Reel} />
        : <ProductTile key={item._id} product={item as Product} />)}
    </div>
  )
}

function Empty({ icon: Icon, title, body }: { icon: typeof Heart; title: string; body: string }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-16 h-16 rounded-full border-2 border-[var(--c-border)] flex items-center justify-center mx-auto mb-4">
        <Icon className="h-7 w-7 text-[var(--c-text-3)]" />
      </div>
      <p className="text-[var(--c-text)] font-semibold">{title}</p>
      <p className="text-[var(--c-text-3)] text-sm mt-1 max-w-xs mx-auto">{body}</p>
    </div>
  )
}

function GridSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {[...Array(9)].map((_, i) => <Skeleton key={i} className={`${tall ? 'aspect-[3/4]' : 'aspect-square'} rounded-none`} />)}
    </div>
  )
}

/**
 * The profile's content area: posted reels and products for everyone, plus
 * Saved and Liked on your own profile only. Those two are private on both
 * Instagram and TikTok — what someone bookmarks or likes is theirs to know.
 */
export function ProfileContent({ userId, isOwnProfile, isSeller }: { userId: string; isOwnProfile: boolean; isSeller: boolean }) {
  const [tab, setTab] = useState<Tab>('reels')
  const [savedKind, setSavedKind] = useState<Kind>('Reel')
  const [likedKind, setLikedKind] = useState<Kind>('Reel')

  // Reset when moving between profiles, so another person's page never opens on
  // a private tab left selected from your own.
  useEffect(() => { setTab('reels') }, [userId])

  const reels = useInfiniteQuery({
    queryKey: ['profile-reels', userId],
    queryFn: async ({ pageParam }): Promise<Page<Reel>> => {
      const res = await api.get<{ data: Reel[]; nextCursor: string | null }>(
        `/reels/user/${userId}${pageParam ? `?cursor=${encodeURIComponent(String(pageParam))}` : ''}`)
      return { items: res.data.data ?? [], next: res.data.nextCursor }
    },
    initialPageParam: null as string | null,
    getNextPageParam: last => (last.next as string | null) ?? undefined,
    enabled: tab === 'reels',
  })

  const posts = useInfiniteQuery({
    queryKey: ['profile-posts', userId],
    queryFn: async ({ pageParam }): Promise<Page<Product>> => {
      const res = await api.get<{ data: Product[] }>(`/products?sellerId=${userId}&limit=24&page=${pageParam}`)
      const items = res.data.data ?? []
      return { items, next: items.length === 24 ? (pageParam as number) + 1 : null }
    },
    initialPageParam: 1,
    getNextPageParam: last => (last.next as number | null) ?? undefined,
    enabled: tab === 'posts',
  })

  const saved = useSocialList('saved', savedKind, isOwnProfile && tab === 'saved')
  const liked = useSocialList('liked', likedKind, isOwnProfile && tab === 'liked')

  const tabs: { key: Tab; label: string; icon: typeof Heart; private?: boolean }[] = [
    { key: 'reels', label: 'Reels', icon: Clapperboard },
    { key: 'posts', label: 'Posts', icon: Grid3x3 },
    ...(isOwnProfile ? [
      { key: 'saved' as Tab, label: 'Saved', icon: Bookmark, private: true },
      { key: 'liked' as Tab, label: 'Liked', icon: Heart, private: true },
    ] : []),
  ]

  const KindToggle = ({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) => (
    <div className="flex gap-1.5 px-3 py-2.5">
      {(['Reel', 'Product'] as Kind[]).map(k => (
        <button key={k} onClick={() => onChange(k)} aria-pressed={value === k}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            value === k ? 'bg-[var(--c-text)] text-[var(--c-bg)]' : 'bg-[var(--c-raised)] text-[var(--c-text-2)] hover:text-[var(--c-text)]'
          }`}>
          {k === 'Reel' ? 'Reels' : 'Posts'}
        </button>
      ))}
      <span className="ml-auto flex items-center gap-1 text-[11px] text-[var(--c-text-4)]">
        <Lock className="h-3 w-3" /> Only you can see this
      </span>
    </div>
  )

  const renderList = (
    q: { data?: { pages: Page<any>[] }; isLoading: boolean; hasNextPage?: boolean; isFetchingNextPage: boolean; fetchNextPage: () => void },
    kind: Kind,
    empty: React.ReactNode,
  ) => {
    if (q.isLoading) return <GridSkeleton tall={kind === 'Reel'} />
    const items = q.data?.pages.flatMap(p => p.items) ?? []
    if (!items.length) return empty
    return (
      <>
        <Grid kind={kind} items={items} />
        <LoadMore active={Boolean(q.hasNextPage) && !q.isFetchingNextPage} onVisible={q.fetchNextPage} />
      </>
    )
  }

  return (
    <div className="md:border-t md:border-[var(--c-border)]">
      <div role="tablist" className="flex border-b md:border-b-0 border-[var(--c-border)] sticky top-[calc(56px+env(safe-area-inset-top,0px))] lg:top-0 z-10 bg-[var(--c-bg)]">
        {tabs.map(t => {
          const on = tab === t.key
          return (
            <button key={t.key} role="tab" aria-selected={on} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 h-12 text-[12px] font-semibold uppercase tracking-wider border-b-2 md:border-b-0 md:border-t-2 -mb-px md:mb-0 md:-mt-px transition-colors ${
                on ? 'border-[var(--c-text)] text-[var(--c-text)]' : 'border-transparent text-[var(--c-text-3)] hover:text-[var(--c-text-2)]'
              }`}>
              <t.icon className="h-[22px] w-[22px] md:h-4 md:w-4" strokeWidth={on ? 2.3 : 1.9} />
              <span className="hidden sm:inline">{t.label}</span>
              {t.private && <Lock className="h-3 w-3 opacity-60" />}
            </button>
          )
        })}
      </div>

      {tab === 'reels' && renderList(reels, 'Reel',
        <Empty icon={Clapperboard} title={isOwnProfile ? 'Share your first reel' : 'No reels yet'}
          body={isOwnProfile ? 'Show your harvest, your farm, your produce up close. Reels are how buyers find you.' : 'When they post reels, you will see them here.'} />)}

      {tab === 'posts' && renderList(posts, 'Product',
        <Empty icon={Package} title={isOwnProfile && isSeller ? 'List your first product' : 'No posts yet'}
          body={isOwnProfile && isSeller ? 'Products you list appear here as posts.' : 'Products they list will appear here.'} />)}

      {tab === 'saved' && isOwnProfile && (
        <>
          <KindToggle value={savedKind} onChange={setSavedKind} />
          {renderList(saved, savedKind,
            <Empty icon={Bookmark} title="Nothing saved yet"
              body={`Tap the bookmark on any ${savedKind === 'Reel' ? 'reel' : 'product'} to keep it here for later.`} />)}
        </>
      )}

      {tab === 'liked' && isOwnProfile && (
        <>
          <KindToggle value={likedKind} onChange={setLikedKind} />
          {renderList(liked, likedKind,
            <Empty icon={Heart} title="No likes yet"
              body={`${likedKind === 'Reel' ? 'Reels' : 'Products'} you like will show up here.`} />)}
        </>
      )}
    </div>
  )
}
