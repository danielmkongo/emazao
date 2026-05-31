import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Search, TrendingUp, MapPin, X, MessageSquare, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, Product, User } from '@/types'

interface Category { _id: string; name: string; slug: string }

const CATEGORY_ICONS: Record<string, string> = {
  'fruits-vegetables': '🥦', 'grains-cereals': '🌾', 'coffee-tea': '☕',
  'spices-herbs': '🌿', 'livestock-poultry': '🐄', 'nuts-seeds': '🥜',
  'roots-tubers': '🥔', 'sugar-confectionery': '🍫', 'oils-fats': '🫒',
}

const TRENDING_TAGS = [
  'organic', 'coffee', 'tomatoes', 'maize', 'cocoa', 'spices',
  'vanilla', 'moringa', 'teff', 'export-grade', 'fair-trade',
]

function useDebounce<T>(value: T, ms: number): T {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t) }, [value, ms])
  return d
}

type Tab = 'products' | 'farmers' | 'live'

interface LiveSession {
  _id: string
  broadcasterId: { _id: string; name: string; username: string; avatar?: string; isVerified?: boolean; country?: string }
  title: string
  viewerCount: number
  startedAt: string
}

export default function Explore() {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('products')
  const [categoryId, setCategoryId] = useState('')
  const debouncedQuery = useDebounce(query, 350)

  const searchActive = debouncedQuery.length >= 1 || categoryId !== ''

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Category[]>>('/categories')
      return res.data.data ?? []
    },
    staleTime: 300_000,
  })

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['explore-products', debouncedQuery, categoryId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '24' })
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (categoryId) params.set('category', categoryId)
      const res = await api.get<ApiResponse<Product[]>>(`/products?${params}`)
      return res.data.data
    },
    staleTime: 20_000,
  })

  const { data: farmersData, isLoading: farmersLoading, error: farmersError } = useQuery({
    queryKey: ['explore-farmers', debouncedQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ role: 'FARMER', limit: '24' })
      if (debouncedQuery) params.set('q', debouncedQuery)
      const res = await api.get<ApiResponse<User[]>>(`/users?${params}`)
      return res.data.data ?? []
    },
    staleTime: 20_000,
    enabled: activeTab === 'farmers',
    retry: 2,
  })

  const { data: liveData, isLoading: liveLoading } = useQuery({
    queryKey: ['live-sessions-explore'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<LiveSession[]>>('/live')
      return res.data.data ?? []
    },
    refetchInterval: 15_000,
    enabled: activeTab === 'live',
  })

  const products = productsData ?? []
  const farmers = farmersData ?? []
  const liveSessions = liveData ?? []

  const tabClass = (t: Tab) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-all ${
      activeTab === t
        ? 'bg-brand-green text-white'
        : 'text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)]'
    }`

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Explore
        </h1>
        <p className="text-[var(--c-text-3)] text-sm">Discover farmers, products, and fresh opportunities</p>
      </motion.div>

      {/* Search bar */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--c-text-3)] pointer-events-none" style={{ height: '17px', width: '17px' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search products, farmers, tags..."
          className="w-full h-12 bg-[var(--c-input)] border border-[var(--c-border)] rounded-2xl pl-11 pr-10 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green transition-all"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--c-text-4)] hover:text-[var(--c-text-2)]">
            <X className="h-4 w-4" />
          </button>
        )}
      </motion.div>

      {/* Category quick-filter */}
      {categories && categories.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
          <button
            onClick={() => setCategoryId('')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              categoryId === ''
                ? 'bg-brand-green/12 border-brand-green text-brand-green'
                : 'border-[var(--c-border)] text-[var(--c-text-3)] hover:border-brand-green/40'
            }`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c._id}
              onClick={() => setCategoryId(prev => prev === c._id ? '' : c._id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                categoryId === c._id
                  ? 'bg-brand-green/12 border-brand-green text-brand-green'
                  : 'border-[var(--c-border)] text-[var(--c-text-3)] hover:border-brand-green/40'
              }`}
            >
              {CATEGORY_ICONS[c.slug] && <span>{CATEGORY_ICONS[c.slug]}</span>}
              {c.name}
            </button>
          ))}
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button className={tabClass('products')} onClick={() => setActiveTab('products')}>Products</button>
        <button className={tabClass('farmers')} onClick={() => setActiveTab('farmers')}>Farmers</button>
        <button className={`${tabClass('live')} flex items-center gap-1.5`} onClick={() => setActiveTab('live')}>
          <Radio className="h-3.5 w-3.5" /> Live
        </button>
      </div>

      {/* Trending tags (when idle) */}
      {!searchActive && activeTab === 'products' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-brand-green" />
            <span className="text-sm font-semibold text-[var(--c-text)]">Trending</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TRENDING_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setQuery(tag)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--c-raised)] text-[var(--c-text-2)] hover:bg-brand-green/12 hover:text-brand-green transition-all border border-[var(--c-border)]"
              >
                #{tag}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Products grid */}
      {activeTab === 'products' && (
        <div>
          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <Search className="h-12 w-12 text-[var(--c-text-4)] mx-auto mb-4" />
              <p className="text-[var(--c-text-3)] font-medium mb-1">No products found</p>
              <p className="text-[var(--c-text-4)] text-sm">Try a different search term or category</p>
            </div>
          ) : (
            <>
              {searchActive && (
                <p className="text-sm text-[var(--c-text-3)] mb-4">
                  <span className="font-semibold text-[var(--c-text)]">{products.length}</span> products found
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product, i) => (
                  <ExploreProductCard key={product._id} product={product} index={i} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Live tab */}
      {activeTab === 'live' && (
        <div>
          {liveLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
          ) : liveSessions.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-16 h-16 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-4">
                <Radio className="h-7 w-7 text-[var(--c-text-4)]" />
              </div>
              <p className="text-[var(--c-text)] font-semibold mb-1">No one is live right now</p>
              <p className="text-[var(--c-text-3)] text-sm">Check back soon — farmers go live to show harvests, answer questions and sell in real time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveSessions.map((session, i) => {
                const b = session.broadcasterId
                return (
                  <motion.div key={session._id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Link to={`/live/${b._id}`}>
                      <div className="group bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] hover:border-red-500/40 hover:shadow-md transition-all overflow-hidden">
                        <div className="p-4 flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-50" />
                            <div className="relative rounded-full border-2 border-red-500 p-0.5">
                              <Avatar src={b.avatar} name={b.name} size="lg" verified={b.isVerified} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                <Radio className="h-2.5 w-2.5" /> LIVE
                              </span>
                            </div>
                            <p className="font-semibold text-[var(--c-text)] text-sm group-hover:text-red-400 transition-colors truncate">{b.name}</p>
                            {session.title && <p className="text-[var(--c-text-3)] text-xs truncate mt-0.5">{session.title}</p>}
                            <p className="text-[var(--c-text-4)] text-xs mt-1">{b.country}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-[var(--c-text-3)]">{session.viewerCount} watching</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Farmers grid */}
      {activeTab === 'farmers' && (
        <div>
          {farmersLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
          ) : farmersError ? (
            <div className="text-center py-20">
              <p className="text-red-400 font-medium mb-1">Failed to load farmers</p>
              <p className="text-[var(--c-text-4)] text-sm">{(farmersError as Error).message}</p>
            </div>
          ) : farmers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[var(--c-text-3)] font-medium">
                {debouncedQuery ? `No farmers found for "${debouncedQuery}"` : 'No farmers yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {farmers.map((farmer, i) => (
                <ExploreFarmerCard key={farmer._id} farmer={farmer} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExploreProductCard({ product, index }: { product: Product; index: number }) {
  const seller = product.sellerId as unknown as User
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link to={`/marketplace/product/${product.slug || product._id}`}>
        <div className="group bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] overflow-hidden hover:border-brand-green/30 hover:shadow-md transition-all">
          <div className="aspect-[4/3] overflow-hidden bg-[var(--c-input)]">
            {product.images?.[0] ? (
              <img
                src={product.images[0]}
                alt={product.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🌾</div>
            )}
          </div>
          <div className="p-3">
            {product.isOrganic && (
              <span className="text-[10px] font-semibold text-brand-green bg-brand-green/10 rounded-full px-2 py-0.5 mb-2 inline-block">
                Organic
              </span>
            )}
            <p className="font-semibold text-[var(--c-text)] text-sm leading-tight mb-1 line-clamp-2 group-hover:text-brand-green transition-colors">
              {product.title}
            </p>
            <p className="font-bold text-[var(--c-text)] text-base font-mono">
              {formatCurrency(product.price)}<span className="text-[var(--c-text-3)] font-normal text-xs ml-1">{product.priceUnit}</span>
            </p>
            {seller && (
              <p className="text-[var(--c-text-4)] text-xs mt-1.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" />{seller.country}
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function ExploreFarmerCard({ farmer, index }: { farmer: User; index: number }) {
  const navigate = useNavigate()
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <div className="flex items-center gap-3 p-4 bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] hover:border-brand-green/30 hover:shadow-sm transition-all">
        <Link to={`/farm/${farmer.username}`} className="flex items-center gap-3 flex-1 min-w-0 group">
          <Avatar src={farmer.avatar} name={farmer.name} size="lg" verified={farmer.isVerified} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--c-text)] text-sm group-hover:text-brand-green transition-colors">{farmer.name}</p>
            <p className="text-[var(--c-text-4)] text-xs flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />{farmer.country}
            </p>
            {(farmer as any).followersCount > 0 && (
              <p className="text-[var(--c-text-3)] text-xs mt-1">
                {formatNumber((farmer as any).followersCount)} followers
              </p>
            )}
          </div>
        </Link>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => navigate(`/messages/new?recipientId=${farmer._id}`, { state: { recipient: farmer } })}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-[var(--c-border)] text-[var(--c-text-3)] hover:border-brand-green hover:text-brand-green transition-all"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message
          </button>
          <Link to={`/farm/${farmer.username}`}>
            <Button size="xs" variant="outline" className="text-xs">View</Button>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
