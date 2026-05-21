import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Filter, Flame, Clock, MapPin } from 'lucide-react'
import { FeedProductCard } from '@/components/feed/FeedProductCard'
import { FeedPostSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import type { FeedItem, Product, Reel } from '@/types'

const filters = [
  { icon: Flame, label: 'Trending', value: 'trending' },
  { icon: Clock, label: 'Latest', value: 'latest' },
  { icon: MapPin, label: 'Nearby', value: 'nearby' },
]

export default function Feed() {
  const [activeFilter, setActiveFilter] = useState('trending')

  const { data, isLoading } = useQuery({
    queryKey: ['feed', activeFilter],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: FeedItem[]; nextCursor: string | null }>('/feed?limit=20')
      return res.data
    },
  })

  const feedItems = data?.data ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          Your Feed
        </h1>
        <Button variant="ghost" size="icon">
          <Filter className="h-5 w-5" />
        </Button>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {filters.map(({ icon: Icon, label, value }) => (
          <button
            key={value}
            onClick={() => setActiveFilter(value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeFilter === value
                ? 'bg-brand-green text-white'
                : 'bg-brand-800 text-white/50 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <FeedPostSkeleton key={i} />)}
        </div>
      ) : feedItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-24"
        >
          <span className="text-6xl mb-4 block">🌾</span>
          <h3 className="text-lg font-semibold text-white mb-2">Your feed is empty</h3>
          <p className="text-white/40 text-sm">Follow some farmers to see their products and reels here.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {feedItems.map((item, i) => {
            if (item.type === 'PRODUCT') {
              return (
                <motion.div
                  key={`product-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <FeedProductCard product={item.data as Product} />
                </motion.div>
              )
            }
            // REEL — show as preview card
            const reel = item.data as Reel
            return (
              <motion.div
                key={`reel-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-brand-800 rounded-2xl border border-white/[0.06] overflow-hidden aspect-[4/3] relative cursor-pointer group"
              >
                {reel.thumbnailUrl ? (
                  <img src={reel.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full bg-brand-700 flex items-center justify-center text-4xl">▶️</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-white text-xs font-medium line-clamp-2">{reel.caption}</p>
                  <p className="text-white/50 text-xs mt-1">{reel.viewCount?.toLocaleString()} views</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
