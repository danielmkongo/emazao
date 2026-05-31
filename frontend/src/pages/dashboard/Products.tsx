import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Package, Eye, Edit, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, Product } from '@/types'

export default function DashboardProducts() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-products', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]>>(`/products?sellerId=${user!._id}&status=all&limit=100`)
      return res.data.data ?? []
    },
    enabled: !!user?._id,
    staleTime: 0,
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">My Products</h1>
        <Button onClick={() => navigate('/dashboard/products/new')}><Plus className="h-4 w-4" /> Add Product</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-400 text-sm">Failed to load products. Please refresh.</p>
        </div>
      ) : !data?.length ? (
        <div className="text-center py-20">
          <Package className="h-12 w-12 text-[var(--c-text-4)] mx-auto mb-4" />
          <p className="text-[var(--c-text-3)] mb-6">No products yet. Add your first listing!</p>
          <Button onClick={() => navigate('/dashboard/products/new')}><Plus className="h-4 w-4" /> Add Product</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((product, i) => (
            <motion.div key={product._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-4"
            >
              <div className="h-16 w-16 rounded-xl overflow-hidden bg-[var(--c-input)] flex-shrink-0">
                {product.images[0]
                  ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-brand-green/10"><Sprout className="h-6 w-6 text-brand-green/50" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[var(--c-text)] truncate">{product.title}</h3>
                <p className="text-sm text-[var(--c-text-3)]">{formatCurrency(product.price)} {product.priceUnit}</p>
              </div>
              <Badge variant={product.status === 'ACTIVE' ? 'default' : 'outline'}>{product.status}</Badge>
              <div className="flex items-center gap-1 text-xs text-[var(--c-text-3)]">
                <Eye className="h-3.5 w-3.5" />{product.viewCount}
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => navigate(`/dashboard/products/${product._id}/edit`)}><Edit className="h-4 w-4" /></Button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
