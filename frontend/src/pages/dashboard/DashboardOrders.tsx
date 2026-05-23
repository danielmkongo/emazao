import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, Order } from '@/types'

const STATUS_VARIANT: Record<string, 'default' | 'gold' | 'organic' | 'urgent' | 'outline'> = {
  COMPLETED: 'default', DELIVERED: 'organic', SHIPPED: 'gold',
  PAYMENT_CONFIRMED: 'gold', PROCESSING: 'gold', PENDING: 'outline',
  CANCELLED: 'urgent', REFUNDED: 'outline', DISPUTED: 'urgent',
}

export default function DashboardOrders() {
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-orders', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Order[]>>('/orders')
      return res.data.data
    },
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--c-text)] mb-6">My Sales</h1>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <div className="text-center py-20">
          <ShoppingBag className="h-12 w-12 text-[var(--c-text-4)] mx-auto mb-4" />
          <p className="text-[var(--c-text-3)]">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((order, i) => (
            <motion.div key={order._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-4">
              <div className="h-12 w-12 rounded-xl overflow-hidden bg-[var(--c-input)] flex-shrink-0">
                {order.items[0]?.image
                  ? <img src={order.items[0].image} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[var(--c-text)] font-medium text-sm truncate">
                  {order.items.map(i => i.title).join(', ')}
                </p>
                <p className="text-[var(--c-text-3)] text-xs mt-0.5">
                  #{order.orderNumber} · {timeAgo(order.createdAt)}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[order.status] ?? 'outline'}>{order.status.replace('_', ' ')}</Badge>
              <p className="text-[var(--c-text)] font-semibold font-mono text-sm">{formatCurrency(order.total)}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
