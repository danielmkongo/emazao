import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Filter, Flame, Clock, MapPin, Play, Sprout } from 'lucide-react'
import { FeedProductCard } from '@/components/feed/FeedProductCard'
import { LiveNowRow } from '@/components/feed/LiveNowRow'
import { FeedPostSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { FeedItem, Product, Reel } from '@/types'

const filters = [
  { icon: Flame,  label: 'Trending', value: 'trending' },
  { icon: Clock,  label: 'Latest',   value: 'latest' },
  { icon: MapPin, label: 'Nearby',   value: 'nearby' },
]

export default function Feed() {
  const [activeFilter, setActiveFilter] = useState('trending')

  const { data, isLoading } = useQuery({
    queryKey: ['feed', activeFilter],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: FeedItem[]; nextCursor: string | null }>(`/feed?limit=20&sort=${activeFilter}`)
      return res.data
    },
  })

  const feedItems = data?.data ?? []

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Live now row */}
      <LiveNowRow />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-5"
      >
        <h1 className="text-2xl font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-display)' }}>
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
            className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeFilter === value
                ? 'text-white'
                : 'bg-[var(--c-card)] text-[var(--c-text-2)] border border-[var(--c-border)] hover:border-brand-green/40'
            }`}
          >
            {activeFilter === value && (
              <motion.div
                layoutId="feed-filter-pill"
                className="absolute inset-0 bg-brand-green rounded-full shadow-md shadow-brand-green/25"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <Icon className="h-4 w-4 relative z-10" />
            <span className="relative z-10">{label}</span>
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
          <div className="w-16 h-16 rounded-2xl bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
            <Sprout className="h-8 w-8 text-brand-green/60" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--c-text)] mb-2">Your feed is empty</h3>
          <p className="text-[var(--c-text-3)] text-sm">Follow some farmers to see their products and reels here.</p>
          <Link to="/explore" className="mt-6 inline-block">
            <Button>Discover Farmers</Button>
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Link to={`/reels/${reel._id}`} state={{ reel }} className="block">
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
  )
}
