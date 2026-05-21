import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import { FeedProductCard } from '@/components/feed/FeedProductCard'
import { ProductCardSkeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import type { ApiResponse, Product } from '@/types'

export default function Marketplace() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]>>('/products?limit=24')
      return res.data.data
    },
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
          <ShoppingBag className="h-7 w-7 text-brand-green" /> Marketplace
        </h1>
        <p className="text-white/40 text-sm mt-1">Fresh products from verified farmers across Africa</p>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : !data?.length ? (
        <div className="text-center py-20">
          <span className="text-6xl mb-4 block">🌾</span>
          <p className="text-white/40">No products yet. Be the first to list!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.map((product, i) => (
            <motion.div key={product._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <FeedProductCard product={product} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
