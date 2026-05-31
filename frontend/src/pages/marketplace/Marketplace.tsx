import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShoppingBag, Search, Sprout, Leaf, X } from 'lucide-react'
import { FeedProductCard } from '@/components/feed/FeedProductCard'
import { ProductCardSkeleton } from '@/components/ui/skeleton'
import { CategoryIcon } from '@/lib/categoryIcons'
import api from '@/lib/api'
import type { ApiResponse, Product } from '@/types'

interface Category { _id: string; name: string; slug: string; icon?: string }

function useDebounce<T>(value: T, ms: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debouncedValue
}

export default function Marketplace() {
  const [search, setSearch] = useState('')
  const [organic, setOrganic] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Category[]>>('/categories')
      return res.data.data ?? []
    },
    staleTime: 300_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['products', debouncedSearch, organic, categoryId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '48' })
      if (debouncedSearch) params.set('q', debouncedSearch)
      if (organic) params.set('organic', 'true')
      if (categoryId) params.set('category', categoryId)
      const res = await api.get<ApiResponse<Product[]>>(`/products?${params}`)
      return res.data.data ?? []
    },
  })

  const products = data ?? []
  const hasFilter = debouncedSearch || organic || categoryId

  const clearAll = () => {
    setSearch('')
    setOrganic(false)
    setCategoryId('')
    inputRef.current?.focus()
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)] flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
          <ShoppingBag className="h-6 w-6 text-brand-green" /> Marketplace
        </h1>
        <p className="text-[var(--c-text-3)] text-sm mt-1">Fresh products from verified farmers across Africa</p>
      </motion.div>

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--c-text-3)] pointer-events-none" />
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products, tags, origins..."
            className="w-full h-11 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl pl-10 pr-4 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--c-text-4)] hover:text-[var(--c-text-2)] transition-colors cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setOrganic(!organic)}
          aria-pressed={organic}
          className={`flex items-center gap-2 px-4 h-11 rounded-xl border text-sm font-medium transition-colors flex-shrink-0 cursor-pointer ${
            organic
              ? 'bg-brand-green/10 border-brand-green text-brand-green'
              : 'bg-[var(--c-card)] border-[var(--c-border)] text-[var(--c-text-2)] hover:border-brand-green/40'
          }`}
        >
          <Leaf className={`h-4 w-4 ${organic ? 'fill-brand-green/20' : ''}`} />
          <span className="hidden sm:inline">Organic</span>
        </button>
      </div>

      {/* Category filter pills */}
      {categories && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          <button
            onClick={() => setCategoryId('')}
            className={`flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              categoryId === ''
                ? 'bg-brand-green/12 border-brand-green text-brand-green'
                : 'border-[var(--c-border)] text-[var(--c-text-3)] hover:border-brand-green/40 hover:text-[var(--c-text-2)]'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat._id}
              onClick={() => setCategoryId(prev => prev === cat._id ? '' : cat._id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                categoryId === cat._id
                  ? 'bg-brand-green/12 border-brand-green text-brand-green'
                  : 'border-[var(--c-border)] text-[var(--c-text-3)] hover:border-brand-green/40 hover:text-[var(--c-text-2)]'
              }`}
            >
              <CategoryIcon slug={cat.slug} className="h-3.5 w-3.5" />
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Results header */}
      {!isLoading && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[var(--c-text-3)]">
            <span className="font-semibold text-[var(--c-text)]">{products.length}</span> products
            {hasFilter && ' found'}
          </p>
          {hasFilter && (
            <button onClick={clearAll} className="text-xs text-[var(--c-text-3)] hover:text-brand-green transition-colors flex items-center gap-1 cursor-pointer">
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : !products.length ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
            <Sprout className="h-8 w-8 text-brand-green/60" />
          </div>
          <p className="text-[var(--c-text)] font-semibold mb-1">No products found</p>
          <p className="text-[var(--c-text-3)] text-sm">Try adjusting your search or removing filters.</p>
          {hasFilter && (
            <button onClick={clearAll} className="mt-4 text-brand-green text-sm font-medium hover:underline cursor-pointer">
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product, i) => (
            <motion.div
              key={product._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <FeedProductCard product={product} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
