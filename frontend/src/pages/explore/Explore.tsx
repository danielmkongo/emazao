import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Search, X, Play, Radio, Loader2, ShieldCheck, Layers, ArrowLeft, Hash, Eye } from 'lucide-react'
import { FeedProductCard, unitLabel } from '@/components/feed/FeedProductCard'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { ReelThumb } from '@/components/reels/ReelThumb'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, FeedItem, Product, Reel, User } from '@/types'

type Tab = 'products' | 'farmers' | 'live'
const TABS: Tab[] = ['products', 'farmers', 'live']
const TAGS = ['organic', 'coffee', 'tomatoes', 'maize', 'avocado', 'cocoa', 'spices', 'vanilla', 'moringa', 'teff']

interface LiveSession {
  _id: string
  broadcasterId: { _id: string; name: string; username: string; avatar?: string; isVerified?: boolean; country?: string }
  title: string
  viewerCount: number
}

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id) }, [value, ms])
  return v
}

/**
 * Explore: Instagram's search page. Idle, it is a mosaic of the most engaging
 * reels and produce, big tiles for video. Start typing and it becomes search,
 * across products, farmers and whoever is live.
 */
export default function Explore() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [focused, setFocused] = useState(false)
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'products') as Tab
  const q = useDebounce(query.trim(), 300)
  const inputRef = useRef<HTMLInputElement>(null)

  // Other pages link here with ?q= or ?tab=; honour them, and keep the URL in
  // step so the back button returns to the same search.
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q); else next.delete('q')
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const searching = !!q || focused || params.has('tab')
  const setTab = (next: Tab) => { const p = new URLSearchParams(params); p.set('tab', next); setParams(p, { replace: true }) }
  const exitSearch = () => { setQuery(''); setFocused(false); setParams({}, { replace: true }); inputRef.current?.blur() }

  return (
    <div className="max-w-[935px] mx-auto pb-10">
      <div className="sticky top-[calc(56px+env(safe-area-inset-top,0px))] lg:top-0 z-20 bar-surface px-4 pt-3 lg:pt-6 pb-3 flex items-center gap-2">
        {searching && (
          <button onClick={exitSearch} aria-label={t('common.back')} className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-[var(--c-text)] press">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-[var(--c-text-3)] pointer-events-none" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setFocused(true)}
            placeholder={t('explore.placeholder')} aria-label={t('explore.placeholder')} enterKeyHint="search"
            className="w-full h-11 rounded-full bg-[var(--c-input)] pl-10 pr-10 text-[15px] text-[var(--c-text)] placeholder:text-[var(--c-text-3)] focus:outline-none focus:ring-2 focus:ring-brand-green/40" />
          {query && (
            <button onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label={t('shop.clearSearch')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)]">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {searching ? (
        <>
          <div className="flex border-b border-[var(--c-border)] px-2" role="tablist">
            {TABS.map(k => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn('flex-1 h-11 text-[14px] font-semibold border-b-2 -mb-px transition-colors',
                  tab === k ? 'border-[var(--c-text)] text-[var(--c-text)]' : 'border-transparent text-[var(--c-text-3)]')}>
                {t(`explore.tabs.${k}`)}
              </button>
            ))}
          </div>
          {!q && tab === 'products' && (
            <div className="px-4 pt-4">
              <p className="text-[13px] font-semibold text-[var(--c-text-3)] mb-2.5">{t('explore.trySearching')}</p>
              <div className="flex flex-wrap gap-2">
                {TAGS.map(tag => (
                  <button key={tag} onClick={() => setQuery(tag)}
                    className="flex items-center gap-1 h-9 px-3.5 rounded-full bg-[var(--c-input)] text-[13.5px] text-[var(--c-text)] hover:bg-[var(--c-raised)] press">
                    <Hash className="h-3.5 w-3.5 text-[var(--c-text-3)]" />{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === 'products' && <ProductResults q={q} />}
          {tab === 'farmers' && <FarmerResults q={q} />}
          {tab === 'live' && <LiveResults />}
        </>
      ) : (
        <Mosaic />
      )}
    </div>
  )
}

// ─── Idle: the mosaic ─────────────────────────────────────────────────────

function Mosaic() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['explore-mosaic'],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
      return (await api.get<{ data: FeedItem[]; nextCursor: string | null }>(`/feed?limit=30&sort=trending${cursor}`)).data
    },
    getNextPageParam: last => last.nextCursor ?? undefined,
    staleTime: 60_000,
  })
  const items = data?.pages.flatMap(p => p.data ?? []) ?? []

  // Instagram's rhythm: in every block of five tiles, one reel stands two rows
  // tall, alternating sides. Reels are pulled forward to fill those slots.
  const tiles = useMemo(() => {
    const reels = items.filter(i => i.type === 'REEL')
    const products = items.filter(i => i.type === 'PRODUCT')
    const out: { item: FeedItem; tall: boolean; right: boolean }[] = []
    let block = 0
    while (reels.length || products.length) {
      const tallReel = reels.shift()
      const right = block % 2 === 1
      const rest: FeedItem[] = []
      while (rest.length < 4 && (products.length || reels.length)) rest.push((products.shift() ?? reels.shift())!)
      if (tallReel) out.push({ item: tallReel, tall: true, right })
      rest.forEach(item => out.push({ item, tall: false, right: false }))
      block++
    }
    return out
  }, [items])

  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !isFetchingNextPage) fetchNextPage() }, { rootMargin: '900px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) return (
    <div className="grid grid-cols-3 gap-[3px]">{[...Array(12)].map((_, i) => <div key={i} className="aspect-square skeleton-shimmer" />)}</div>
  )

  return (
    <>
      {/* Rows are a third of the width, so a two-row reel is exactly 2:3. */}
      <div className="@container">
        <div className="grid grid-cols-3 gap-[3px] [grid-auto-flow:dense]" style={{ gridAutoRows: 'calc((100cqw - 6px) / 3)' }}>
          {tiles.map(({ item, tall, right }) => (
            <Tile key={`${item.type}-${(item.data as { _id: string })._id}`} item={item} className={cn(tall && 'row-span-2', tall && right && 'col-start-3')} />
          ))}
        </div>
      </div>
      <div ref={sentinel} />
      {isFetchingNextPage && <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--c-text-3)]" /></div>}
    </>
  )
}

function Tile({ item, className }: { item: FeedItem; className?: string }) {
  if (item.type === 'REEL') {
    const reel = item.data as Reel
    return (
      <Link to={`/reels/${reel._id}`} state={{ reel }} className={cn('relative block bg-neutral-900 overflow-hidden group', className)}>
        <ReelThumb thumbnailUrl={reel.thumbnailUrl} videoUrl={reel.videoUrl} className="absolute inset-0 w-full h-full group-hover:scale-[1.03] transition-transform duration-500" />
        <span className="absolute top-2 right-2 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"><Play className="h-5 w-5 fill-white" /></span>
        <span className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-[12px] font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
          <Eye className="h-3.5 w-3.5" />{formatNumber(reel.viewCount ?? 0)}
        </span>
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </Link>
    )
  }
  const p = item.data as Product
  return (
    <Link to={`/marketplace/product/${p.slug || p._id}`} className={cn('relative block bg-[var(--c-input)] overflow-hidden group', className)}>
      <ImageWithFallback src={p.images?.[0]} alt={p.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" fallbackClassName="absolute inset-0 w-full h-full" />
      {p.images?.length > 1 && <span className="absolute top-2 right-2 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"><Layers className="h-[18px] w-[18px]" /></span>}
      {/* Price appears on hover (desktop) and always as a small tag (phones) */}
      <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate px-1.5 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold tabular">
        {formatCurrency(p.price)}<span className="text-white/70 font-medium">/{unitLabel(p.priceUnit)}</span>
      </span>
      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
    </Link>
  )
}

// ─── Searching ────────────────────────────────────────────────────────────

function ProductResults({ q }: { q: string }) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['explore-products', q],
    queryFn: async () => (await api.get<ApiResponse<Product[]>>(`/products?limit=30${q ? `&q=${encodeURIComponent(q)}` : '&sort=popular'}`)).data.data ?? [],
    staleTime: 20_000,
  })
  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--c-text-3)]" /></div>
  if (!data?.length) return <Empty text={t('explore.noProducts', { q })} />
  return (
    <div className="px-4 pt-5">
      {!q && <p className="text-[13px] font-semibold text-[var(--c-text-3)] mb-3">{t('explore.popular')}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-6">{data.map(p => <FeedProductCard key={p._id} product={p} />)}</div>
    </div>
  )
}

function FarmerResults({ q }: { q: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const me = useAuthStore(s => s.user)
  const [following, setFollowing] = useState<Record<string, boolean>>({})
  useQuery({
    queryKey: ['my-following', me?._id],
    queryFn: async () => {
      const list = (await api.get<ApiResponse<User[]>>(`/users/${me!.username}/following`)).data.data ?? []
      setFollowing(f => ({ ...Object.fromEntries(list.map(u => [u._id, true])), ...f }))
      return list
    },
    enabled: !!me,
    staleTime: 60_000,
  })
  const { data, isLoading } = useQuery({
    queryKey: ['explore-farmers', q],
    queryFn: async () => {
      const p = new URLSearchParams({ role: 'FARMER', limit: '40' })
      if (q) p.set('q', q)
      return (await api.get<ApiResponse<User[]>>(`/users?${p}`)).data.data ?? []
    },
    staleTime: 20_000,
  })
  const follow = async (id: string) => {
    if (!me) { navigate('/login'); return }
    setFollowing(f => ({ ...f, [id]: !f[id] }))
    try {
      const r = await api.post<ApiResponse<{ following: boolean }>>(`/users/${id}/follow`)
      setFollowing(f => ({ ...f, [id]: !!r.data.data?.following }))
    } catch { setFollowing(f => ({ ...f, [id]: !f[id] })) }
  }
  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--c-text-3)]" /></div>
  const list = (data ?? []).filter(u => u._id !== me?._id)
  if (!list.length) return <Empty text={t('explore.noFarmers', { q })} />
  return (
    <div className="py-2">
      {list.map(u => (
        <div key={u._id} className="flex items-center gap-3 px-4 py-2.5">
          <Link to={`/profile/${u.username}`} className="flex items-center gap-3 flex-1 min-w-0">
            {u.avatar ? <img src={u.avatar} alt="" className="w-12 h-12 rounded-full object-cover" /> : <span className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-green to-ink" />}
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[14.5px] font-semibold text-[var(--c-text)]">
                <span className="truncate">{u.username}</span>{u.isVerified && <ShieldCheck className="h-4 w-4 text-brand-green flex-shrink-0" />}
              </span>
              <span className="block text-[13px] text-[var(--c-text-3)] truncate">{u.name}{u.country ? ` · ${[u.region, u.country].filter(Boolean).join(', ')}` : ''}</span>
            </span>
          </Link>
          <button onClick={() => follow(u._id)}
            className={cn('h-8 px-4 rounded-lg text-[13px] font-semibold press',
              following[u._id] ? 'bg-[var(--c-input)] text-[var(--c-text)]' : 'bg-brand-green text-white hover:bg-brand-emerald')}>
            {following[u._id] ? t('common.following') : t('common.follow')}
          </button>
        </div>
      ))}
    </div>
  )
}

function LiveResults() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['live-sessions-explore'],
    queryFn: async () => { try { return (await api.get<ApiResponse<LiveSession[]>>('/live')).data.data ?? [] } catch { return [] } },
    refetchInterval: 15_000,
  })
  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--c-text-3)]" /></div>
  if (!data?.length) return (
    <div className="text-center py-16 px-6">
      <div className="w-16 h-16 rounded-full border-2 border-[var(--c-border)] flex items-center justify-center mx-auto mb-4"><Radio className="h-7 w-7 text-[var(--c-text-3)]" /></div>
      <p className="text-[var(--c-text)] font-semibold">{t('explore.noLive')}</p>
      <p className="text-[var(--c-text-3)] text-sm mt-1">{t('explore.noLiveBody')}</p>
    </div>
  )
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
      {data.map(s => (
        <Link key={s._id} to={`/live/${s.broadcasterId._id}`} className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-900 group">
          {s.broadcasterId.avatar && <img src={s.broadcasterId.avatar} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-extrabold tracking-wider">LIVE</span>
          <span className="absolute top-2 right-2 flex items-center gap-1 text-white text-[11px] font-semibold bg-black/40 px-1.5 py-0.5 rounded"><Eye className="h-3 w-3" />{formatNumber(s.viewerCount)}</span>
          <div className="absolute inset-x-2.5 bottom-2.5 text-white">
            <p className="text-[13px] font-semibold truncate">{s.broadcasterId.name}</p>
            <p className="text-[12px] text-white/75 line-clamp-2">{s.title}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-[var(--c-text-3)] text-sm py-16 px-6">{text}</p>
}
