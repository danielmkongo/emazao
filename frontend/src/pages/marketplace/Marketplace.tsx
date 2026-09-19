import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Search, X, Leaf, Sprout, ArrowUpDown, Loader2, Flame, ChevronRight, HeartPulse } from 'lucide-react'
import { FeedProductCard, unitLabel } from '@/components/feed/FeedProductCard'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { CategoryIcon } from '@/lib/categoryIcons'
import { NUTRITION_GROUPS, ALL_NUTRITION, NUTRITION_DISCLAIMER, type NutritionKey } from '@/lib/nutrition'
import { formatCurrency, cn } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, Product } from '@/types'

interface Category { _id: string; name: string; slug: string }

const SORTS = ['recommended', 'popular', 'newest', 'price_asc', 'price_desc'] as const
type Sort = typeof SORTS[number]
const PAGE = 24

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id) }, [value, ms])
  return v
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cn('flex-shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13.5px] font-medium transition-colors press',
        active ? 'bg-[var(--c-text)] text-[var(--c-bg)]' : 'bg-[var(--c-input)] text-[var(--c-text)] hover:bg-[var(--c-raised)]')}>
      {children}
    </button>
  )
}

function GroupChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cn('flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium border transition-colors press',
        active ? 'border-brand-green bg-brand-green/10 text-brand-green' : 'border-[var(--c-border)] text-[var(--c-text-2)] hover:text-[var(--c-text)]')}>
      {children}
    </button>
  )
}

export default function Marketplace() {
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const [organic, setOrganic] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [sort, setSort] = useState<Sort>('recommended')
  // Special nutrition is a filter like any other chip: it narrows this grid in
  // place ('' = off, 'ALL' = every group, or one group) rather than leaving
  // the page. Arriving with ?nutrition= (older links) turns it on.
  const [params, setParams] = useSearchParams()
  const [nutrition, setNutrition] = useState<'' | 'ALL' | NutritionKey>(() => {
    const v = params.get('nutrition')?.toUpperCase()
    return v === 'ALL' || NUTRITION_GROUPS.some(g => g.key === v) ? (v as 'ALL' | NutritionKey) : ''
  })
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (nutrition) next.set('nutrition', nutrition.toLowerCase()); else next.delete('nutrition')
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [nutrition]) // eslint-disable-line react-hooks/exhaustive-deps
  const sw = i18n.resolvedLanguage === 'sw'
  const topRef = useRef<HTMLDivElement>(null)
  const toggleNutrition = () => {
    setNutrition(n => (n ? '' : 'ALL'))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const q = useDebounce(search.trim(), 350)
  const filtered = !!(q || organic || categoryId || nutrition || sort !== 'recommended')

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<ApiResponse<Category[]>>('/categories')).data.data ?? [],
    staleTime: 300_000,
  })

  const { data: trending } = useQuery({
    queryKey: ['rp-trending-products'],
    queryFn: async () => (await api.get<ApiResponse<Product[]>>('/search/trending')).data.data ?? [],
    staleTime: 60_000,
  })

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['products', q, organic, categoryId, sort, nutrition],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE), page: String(pageParam), sort })
      if (q) params.set('q', q)
      if (organic) params.set('organic', 'true')
      if (categoryId) params.set('category', categoryId)
      if (nutrition) params.set('nutrition', nutrition === 'ALL' ? ALL_NUTRITION : nutrition)
      return (await api.get<ApiResponse<Product[]>>(`/products?${params}`)).data
    },
    getNextPageParam: (last, pages) => {
      const total = last.pagination?.total ?? 0
      return pages.length * PAGE < total ? pages.length + 1 : undefined
    },
  })
  const products = data?.pages.flatMap(p => p.data ?? []) ?? []
  const total = data?.pages[0]?.pagination?.total ?? products.length

  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !isFetchingNextPage) fetchNextPage() }, { rootMargin: '800px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const clearAll = () => { setSearch(''); setOrganic(false); setCategoryId(''); setNutrition(''); setSort('recommended') }

  return (
    <div className="max-w-5xl mx-auto pb-10" ref={topRef}>
      {/* Search + filters stay put while the grid scrolls under them */}
      <div className="sticky top-[calc(56px+env(safe-area-inset-top,0px))] lg:top-0 z-20 bar-surface pt-3 lg:pt-6 pb-2">
        <div className="px-4 flex items-center gap-3 mb-3">
          <h1 className="hidden lg:block text-[26px] font-extrabold text-[var(--c-text)] tracking-tight mr-2" style={{ fontFamily: 'var(--font-display)' }}>
            {t('nav.market')}
          </h1>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-[var(--c-text-3)] pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('shop.searchPlaceholder')} aria-label={t('shop.searchPlaceholder')}
              className="w-full h-11 rounded-full bg-[var(--c-input)] pl-10 pr-10 text-[15px] text-[var(--c-text)] placeholder:text-[var(--c-text-3)] focus:outline-none focus:ring-2 focus:ring-brand-green/40" />
            {search && (
              <button onClick={() => setSearch('')} aria-label={t('shop.clearSearch')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <label className="relative flex-shrink-0 w-11 h-11 sm:w-auto rounded-full bg-[var(--c-input)] flex items-center justify-center" title={t('shop.sortBy')}>
            <span className="sr-only">{t('shop.sortBy')}</span>
            <ArrowUpDown className={cn('h-[18px] w-[18px] sm:h-4 sm:w-4 sm:absolute sm:left-3 pointer-events-none', sort !== 'recommended' ? 'text-brand-green' : 'text-[var(--c-text-2)]')} />
            {/* The native picker: invisible over the icon on phones, a labelled pill on wider screens. */}
            <select value={sort} onChange={e => setSort(e.target.value as Sort)}
              className="absolute inset-0 opacity-0 sm:static sm:opacity-100 h-11 rounded-full bg-transparent sm:pl-9 sm:pr-3 text-[13.5px] font-medium text-[var(--c-text)] appearance-none focus:outline-none cursor-pointer">
              {SORTS.map(s => <option key={s} value={s}>{t(`shop.sort.${s}`)}</option>)}
            </select>
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
          {/* Special nutrition leads the row: a way of shopping, so it filters
              right here like the other chips. */}
          <Chip active={!!nutrition} onClick={toggleNutrition}><HeartPulse className="h-4 w-4" />{t('nav.nutrition')}</Chip>
          <Chip active={organic} onClick={() => setOrganic(o => !o)}><Leaf className="h-4 w-4" />{t('feed.organic')}</Chip>
          <Chip active={!categoryId} onClick={() => setCategoryId('')}>{t('shop.all')}</Chip>
          {categories?.map(c => (
            <Chip key={c._id} active={categoryId === c._id} onClick={() => setCategoryId(p => (p === c._id ? '' : c._id))}>
              <CategoryIcon slug={c.slug} className="h-4 w-4" />{c.name}
            </Chip>
          ))}
        </div>
        {nutrition && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 mt-2">
            <GroupChip active={nutrition === 'ALL'} onClick={() => setNutrition('ALL')}>{t('shop.allGroups')}</GroupChip>
            {NUTRITION_GROUPS.map(g => (
              <GroupChip key={g.key} active={nutrition === g.key} onClick={() => setNutrition(g.key)}>
                <g.icon className="h-4 w-4" />{sw ? g.sw : g.en}
              </GroupChip>
            ))}
          </div>
        )}
      </div>

      {/* Selling fast + the nutrition shortcut, only on the unfiltered front page */}
      {!filtered && (
        <>
          {!!trending?.length && (
            <section className="mt-4">
              <div className="flex items-center justify-between px-4 mb-3">
                <h2 className="flex items-center gap-2 text-[17px] font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                  <Flame className="h-5 w-5 text-harvest" /> {t('panel.sellingFast')}
                </h2>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 snap-x scroll-px-4">
                {trending.slice(0, 10).map((p, i) => (
                  <Link key={p._id} to={`/marketplace/product/${p.slug || p._id}`} className="relative w-[150px] flex-shrink-0 snap-start group">
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--c-input)]">
                      <ImageWithFallback src={p.images?.[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" fallbackClassName="w-full h-full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                      <span className="absolute top-2 left-2 w-7 h-7 rounded-full bg-white text-black text-[13px] font-extrabold flex items-center justify-center shadow" style={{ fontFamily: 'var(--font-display)' }}>{i + 1}</span>
                      <div className="absolute inset-x-2.5 bottom-2.5 text-white">
                        <p className="text-[12.5px] font-medium leading-tight line-clamp-2">{p.title}</p>
                        <p className="text-[14px] font-bold tabular mt-0.5">{formatCurrency(p.price)}<span className="text-white/70 text-[11px] font-medium"> / {unitLabel(p.priceUnit)}</span></p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <button onClick={toggleNutrition} className="mx-4 mt-5 w-[calc(100%-2rem)] text-left flex items-center gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-brand-green/12 via-brand-lime/10 to-harvest/12 border border-brand-green/15 press">
            <span className="w-11 h-11 rounded-xl bg-brand-green text-white flex items-center justify-center flex-shrink-0"><HeartPulse className="h-6 w-6" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-[var(--c-text)]">{t('nav.nutrition')}</span>
              <span className="block text-[13px] text-[var(--c-text-3)]">{t('shop.nutritionHint')}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-[var(--c-text-3)]" />
          </button>
        </>
      )}

      <div className="flex items-center justify-between px-4 mt-6 mb-3">
        <h2 className="text-[17px] font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-display)' }}>
          {filtered ? t('shop.results', { count: total }) : t('shop.freshToday')}
        </h2>
        {filtered && <button onClick={clearAll} className="text-[13.5px] font-semibold text-brand-green">{t('shop.clearAll')}</button>}
      </div>

      {nutrition && (() => {
        const g = NUTRITION_GROUPS.find(x => x.key === nutrition)
        return (
          <div className="mx-4 mb-4 flex items-start gap-3 p-3.5 rounded-2xl bg-brand-green/[0.07]">
            <HeartPulse className="h-5 w-5 text-brand-green flex-shrink-0 mt-0.5" />
            <div className="text-[13px] leading-snug">
              <p className="font-semibold text-[var(--c-text)]">{g ? (sw ? g.sw : g.en) : t('nav.nutrition')}</p>
              <p className="text-[var(--c-text-2)]">{g ? (sw ? g.swDesc : g.enDesc) : t('shop.nutritionHint')}</p>
              <p className="text-[var(--c-text-3)] text-[12px] mt-1">{sw ? NUTRITION_DISCLAIMER.sw : NUTRITION_DISCLAIMER.en}</p>
            </div>
          </div>
        )
      })()}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-6 px-4">
          {[...Array(8)].map((_, i) => (
            <div key={i}><div className="aspect-square rounded-2xl skeleton-shimmer" /><div className="h-4 w-20 mt-3 rounded skeleton-shimmer" /><div className="h-3 w-full mt-2 rounded skeleton-shimmer" /></div>
          ))}
        </div>
      ) : !products.length ? (
        <div className="text-center py-20 px-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-green/10 flex items-center justify-center mx-auto mb-4"><Sprout className="h-8 w-8 text-brand-green" /></div>
          <p className="text-[var(--c-text)] font-semibold mb-1">{nutrition ? t('shop.noNutritionTitle') : t('shop.noneTitle')}</p>
          <p className="text-[var(--c-text-3)] text-sm">{nutrition ? t('shop.noNutritionBody') : t('shop.noneBody')}</p>
          {filtered && <button onClick={clearAll} className="mt-4 text-brand-green text-sm font-semibold">{t('shop.clearAll')}</button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-6 px-4">
          {products.map(p => <FeedProductCard key={p._id} product={p} />)}
        </div>
      )}
      <div ref={sentinel} />
      {isFetchingNextPage && <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--c-text-3)]" /></div>}
    </div>
  )
}
