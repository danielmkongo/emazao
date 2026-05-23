import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShoppingBag, ChevronRight, Clock, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, Order } from '@/types'

const statusVariant: Record<string, 'default' | 'gold' | 'organic' | 'urgent' | 'outline'> = {
  PENDING: 'outline',
  PAYMENT_CONFIRMED: 'gold',
  PROCESSING: 'gold',
  SHIPPED: 'organic',
  DELIVERED: 'default',
  COMPLETED: 'default',
  CANCELLED: 'urgent',
  REFUNDED: 'outline',
  DISPUTED: 'urgent',
}

const statusLabel: Record<string, string> = {
  PENDING: 'Pending',
  PAYMENT_CONFIRMED: 'Paid',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  DISPUTED: 'Disputed',
}

export default function Orders() {
  const { user } = useAuthStore()
  const isFarmer = user?.role === 'FARMER'

  const { data, isLoading } = useQuery({
    queryKey: ['orders', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Order[]>>('/orders')
      return res.data.data
    },
  })

  const title = isFarmer ? 'My Sales' : 'My Purchases'
  const emptyLabel = isFarmer ? 'No sales yet' : 'No orders yet'
  const emptySubLabel = isFarmer
    ? 'Orders placed for your products will appear here'
    : 'Your purchases will appear here'

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">{title}</h1>
        {data?.length ? (
          <span className="text-sm text-[var(--c-text-3)]">
            <span className="font-semibold text-[var(--c-text)]">{data.length}</span> order{data.length !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-4">
            {isFarmer
              ? <Package className="h-7 w-7 text-[var(--c-text-4)]" />
              : <ShoppingBag className="h-7 w-7 text-[var(--c-text-4)]" />
            }
          </div>
          <p className="text-[var(--c-text)] font-semibold mb-1">{emptyLabel}</p>
          <p className="text-[var(--c-text-3)] text-sm">{emptySubLabel}</p>
          {!isFarmer && (
            <Link to="/marketplace" className="mt-6 inline-block">
              <button className="px-5 py-2 rounded-xl bg-brand-green text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                Browse Marketplace
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((order, i) => (
            <motion.div key={order._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to={`/orders/${order._id}`}>
                <div className="flex items-center gap-4 bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 hover:border-brand-green/30 hover:shadow-sm transition-all group">
                  {/* Product image */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--c-input)] flex-shrink-0">
                    {order.items[0]?.image ? (
                      <img src={order.items[0].image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🌾</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-xs text-[var(--c-text-3)]">{order.orderNumber}</span>
                      <Badge variant={statusVariant[order.status] ?? 'outline'}>
                        {statusLabel[order.status] ?? order.status}
                      </Badge>
                    </div>
                    <p className="text-[var(--c-text)] font-medium text-sm mb-1 group-hover:text-brand-green transition-colors">
                      {order.items[0]?.title}
                      {order.items.length > 1 && <span className="text-[var(--c-text-3)]"> +{order.items.length - 1} more</span>}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold text-[var(--c-text)] font-mono">{formatCurrency(order.total)}</span>
                      <span className="flex items-center gap-1 text-[var(--c-text-3)]">
                        <Clock className="h-3 w-3" />{timeAgo(order.createdAt)}
                      </span>
                      {order.items[0]?.quantity && (
                        <span className="text-[var(--c-text-3)]">
                          {order.items[0].quantity} {order.items[0].unit}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--c-text-4)] flex-shrink-0 group-hover:text-brand-green transition-colors" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
