import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShoppingBag, Search, SlidersHorizontal, Leaf } from 'lucide-react'
import { FeedProductCard } from '@/components/feed/FeedProductCard'
import { ProductCardSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import type { ApiResponse, Product } from '@/types'

export default function Marketplace() {
  const [search, setSearch] = useState('')
  const [organic, setOrganic] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['products', organic],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '40' })
      if (organic) params.set('organic', 'true')
      const res = await api.get<ApiResponse<Product[]>>(`/products?${params}`)
      return res.data.data
    },
  })

  const filtered = (data ?? []).filter(
    (p) => !search || p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--c-text)] flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
          <ShoppingBag className="h-7 w-7 text-brand-green" /> Marketplace
        </h1>
        <p className="text-[var(--c-text-3)] text-sm mt-1">Fresh products from verified farmers across Africa</p>
      </motion.div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--c-text-3)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full h-11 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl pl-10 pr-4 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green transition-all"
          />
        </div>
        <button
          onClick={() => setOrganic(!organic)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            organic
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600'
              : 'bg-[var(--c-card)] border-[var(--c-border)] text-[var(--c-text-2)] hover:border-emerald-500/30'
          }`}
        >
          <Leaf className="h-4 w-4" /> Organic Only
        </button>
        <Button variant="secondary" size="md" className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </Button>
      </div>

      {/* Count */}
      {!isLoading && (
        <p className="text-sm text-[var(--c-text-3)] mb-4">
          <span className="font-semibold text-[var(--c-text)]">{filtered.length}</span> products found
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-20">
          <span className="text-6xl mb-4 block">🌾</span>
          <p className="text-[var(--c-text-3)]">No products found. Try adjusting your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((product, i) => (
            <motion.div key={product._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <FeedProductCard product={product} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
