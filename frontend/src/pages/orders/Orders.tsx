import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShoppingBag, ChevronRight, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
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

export default function Orders() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Order[]>>('/orders')
      return res.data.data
    },
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">My Orders</h1>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <div className="text-center py-20">
          <ShoppingBag className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 mb-2">No orders yet</p>
          <p className="text-white/20 text-sm">Your purchases will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((order, i) => (
            <motion.div key={order._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to={`/orders/${order._id}`}
                className="flex items-center gap-4 bg-brand-800 rounded-2xl border border-white/[0.06] p-5 hover:border-white/10 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-xs text-white/40">{order.orderNumber}</span>
                    <Badge variant={statusVariant[order.status] ?? 'outline'}>{order.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-white font-medium mb-1">
                    {order.items.length} item{order.items.length > 1 ? 's' : ''} · {order.items[0]?.title}
                    {order.items.length > 1 && ` +${order.items.length - 1} more`}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-white/40">
                    <span className="font-semibold text-white">{formatCurrency(order.total)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(order.createdAt)}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
