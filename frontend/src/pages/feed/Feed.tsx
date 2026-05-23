import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Filter, Flame, Clock, MapPin, Play, TrendingUp, ChevronRight } from 'lucide-react'
import { FeedProductCard } from '@/components/feed/FeedProductCard'
import { FeedPostSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatNumber, formatCurrency, timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import type { FeedItem, Product, Reel, User, ApiResponse } from '@/types'

const filters = [
  { icon: Flame,  label: 'Trending', value: 'trending' },
  { icon: Clock,  label: 'Latest',   value: 'latest' },
  { icon: MapPin, label: 'Nearby',   value: 'nearby' },
]

const TRENDING_TAGS = ['organic', 'coffee', 'maize', 'cocoa', 'spices', 'moringa', 'teff', 'vanilla', 'export']

export default function Feed() {
  const [activeFilter, setActiveFilter] = useState('trending')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['feed', activeFilter],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: FeedItem[]; nextCursor: string | null }>(`/feed?limit=20&sort=${activeFilter}`)
      return res.data
    },
  })

  const followMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/users/${userId}/follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suggested-farmers'] }),
  })

  const { data: farmersData } = useQuery({
    queryKey: ['suggested-farmers'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<User[]>>('/users?role=FARMER&limit=5')
      return res.data.data ?? []
    },
    staleTime: 60_000,
  })

  const { data: topProductsData } = useQuery({
    queryKey: ['top-products'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]>>('/products?limit=4')
      return res.data.data ?? []
    },
    staleTime: 60_000,
  })

  const feedItems = data?.data ?? []
  const farmers = farmersData ?? []
  const topProducts = topProductsData ?? []

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Desktop 2-col: main feed + right panel */}
      <div className="flex gap-6">

        {/* ── Main feed column ── */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-5"
          >
            <h1 className="text-xl font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-display)' }}>
              Your Feed
            </h1>
            <Button variant="ghost" size="icon">
              <Filter className="h-5 w-5" />
            </Button>
          </motion.div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
            {filters.map(({ icon: Icon, label, value }) => (
              <button
                key={value}
                onClick={() => setActiveFilter(value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeFilter === value
                    ? 'bg-brand-green text-white shadow-md shadow-brand-green/20'
                    : 'bg-[var(--c-card)] text-[var(--c-text-2)] border border-[var(--c-border)] hover:border-brand-green/40'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Feed items */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => <FeedPostSkeleton key={i} />)}
            </div>
          ) : feedItems.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
              <span className="text-6xl mb-4 block">🌾</span>
              <h3 className="text-lg font-semibold text-[var(--c-text)] mb-2">Your feed is empty</h3>
              <p className="text-[var(--c-text-3)] text-sm">Follow some farmers to see their products and reels here.</p>
              <Link to="/explore" className="mt-6 inline-block">
                <Button>Discover Farmers</Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {feedItems.map((item, i) => {
                if (item.type === 'PRODUCT') {
                  return (
                    <motion.div key={`product-${i}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <FeedProductCard product={item.data as Product} />
                    </motion.div>
                  )
                }
                const reel = item.data as Reel
                return (
                  <motion.div key={`reel-${i}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Link to="/reels" className="block">
                      <div className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] overflow-hidden aspect-[4/3] relative cursor-pointer group shadow-sm hover:shadow-md transition-shadow">
                        {reel.thumbnailUrl ? (
                          <img src={reel.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full bg-[var(--c-input)] flex items-center justify-center">
                            <Play className="h-12 w-12 text-[var(--c-text-4)]" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <div className="absolute top-3 left-3">
                          <span className="flex items-center gap-1 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
                            <Play className="h-3 w-3 fill-white" /> Reel
                          </span>
                        </div>
                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="text-white text-xs font-medium line-clamp-2">{reel.caption}</p>
                          <p className="text-white/60 text-xs mt-1">{formatNumber(reel.viewCount ?? 0)} views</p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right panel — desktop only ── */}
        <aside className="hidden xl:flex flex-col gap-5 w-72 flex-shrink-0">

          {/* Suggested Farmers */}
          {farmers.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[var(--c-text)] text-sm">Top Farmers</h3>
                <Link to="/explore?tab=farmers" className="text-xs text-brand-green hover:underline">See all</Link>
              </div>
              <div className="space-y-3">
                {farmers.slice(0, 4).map(farmer => (
                  <Link key={farmer._id} to={`/farm/${farmer.username}`}>
                    <div className="flex items-center gap-3 hover:bg-[var(--c-raised)] rounded-xl p-2 -mx-2 transition-colors group">
                      <Avatar src={farmer.avatar} name={farmer.name} size="sm" verified={farmer.isVerified} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--c-text)] text-xs group-hover:text-brand-green transition-colors truncate">{farmer.name}</p>
                        <p className="text-[var(--c-text-4)] text-xs">{farmer.country}</p>
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        className="text-xs flex-shrink-0"
                        onClick={e => { e.preventDefault(); followMutation.mutate(farmer._id) }}
                      >
                        Follow
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Trending Tags */}
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-brand-green" />
              <h3 className="font-semibold text-[var(--c-text)] text-sm">Trending</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRENDING_TAGS.map(tag => (
                <Link key={tag} to={`/explore?q=${tag}`}>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--c-raised)] text-[var(--c-text-2)] hover:bg-brand-green/12 hover:text-brand-green transition-all border border-[var(--c-border)] cursor-pointer">
                    #{tag}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Hot products */}
          {topProducts.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
              className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[var(--c-text)] text-sm">Hot Products</h3>
                <Link to="/marketplace" className="text-xs text-brand-green hover:underline">Browse</Link>
              </div>
              <div className="space-y-2">
                {topProducts.map(product => (
                  <Link key={product._id} to={`/marketplace/product/${product.slug || product._id}`}>
                    <div className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-[var(--c-raised)] transition-colors group">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--c-input)] flex-shrink-0">
                        {product.images?.[0]
                          ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-lg">🌾</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--c-text)] text-xs font-medium truncate group-hover:text-brand-green transition-colors">{product.title}</p>
                        <p className="text-brand-green text-xs font-semibold font-mono">{formatCurrency(product.price)}<span className="text-[var(--c-text-4)] font-normal"> {product.priceUnit}</span></p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Platform note */}
          <p className="text-[var(--c-text-4)] text-xs px-1">
            eMazao · Agricultural Commerce · © {new Date().getFullYear()}
          </p>
        </aside>

      </div>
    </div>
  )
}
