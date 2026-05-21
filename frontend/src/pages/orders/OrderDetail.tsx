import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Package, MapPin, CheckCircle, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, Order, User } from '@/types'

const statusVariant: Record<string, 'default' | 'gold' | 'organic' | 'urgent' | 'outline'> = {
  PENDING: 'outline', PAYMENT_CONFIRMED: 'gold', PROCESSING: 'gold',
  SHIPPED: 'organic', DELIVERED: 'default', COMPLETED: 'default',
  CANCELLED: 'urgent', REFUNDED: 'outline', DISPUTED: 'urgent',
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Order>>(`/orders/${id}`)
      return res.data.data
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/orders/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const disputeMutation = useMutation({
    mutationFn: () => api.post(`/orders/${id}/dispute`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
  )

  if (!order) return null

  const seller = order.sellerId as unknown as User
  const buyer = order.buyerId as unknown as User
  const isBuyer = user?._id === (typeof order.buyerId === 'string' ? order.buyerId : buyer?._id)
  const canConfirm = isBuyer && order.status === 'SHIPPED'
  const canDispute = isBuyer && ['SHIPPED', 'DELIVERED'].includes(order.status)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/40 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-mono text-sm text-white/40">{order.orderNumber}</p>
          <p className="text-white/40 text-sm">{timeAgo(order.createdAt)}</p>
        </div>
        <Badge variant={statusVariant[order.status] ?? 'outline'} className="text-sm px-4 py-1">
          {order.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Items */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-brand-800 rounded-2xl border border-white/[0.06] p-5 mb-4">
        <h3 className="font-medium text-white mb-4">Items</h3>
        <div className="space-y-3">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg overflow-hidden bg-brand-700 flex-shrink-0">
                {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package className="h-6 w-6 text-white/30 m-3" />}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">{item.title}</p>
                <p className="text-white/40 text-xs">{item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}</p>
              </div>
              <p className="text-white font-semibold">{formatCurrency(item.totalPrice)}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-1">
          <div className="flex justify-between text-sm text-white/60">
            <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-white/60">
            <span>Delivery</span><span>{formatCurrency(order.deliveryFee)}</span>
          </div>
          <div className="flex justify-between text-sm text-white/60">
            <span>Platform fee</span><span>{formatCurrency(order.platformFee)}</span>
          </div>
          <div className="flex justify-between font-bold text-white pt-1">
            <span>Total</span><span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </motion.div>

      {/* Delivery Address */}
      {order.deliveryAddress && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-brand-800 rounded-2xl border border-white/[0.06] p-5 mb-4">
          <h3 className="font-medium text-white mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-green" />Delivery Address
          </h3>
          <p className="text-white/60 text-sm">{order.deliveryAddress.street}, {order.deliveryAddress.city}</p>
          <p className="text-white/60 text-sm">{order.deliveryAddress.region}, {order.deliveryAddress.country}</p>
        </motion.div>
      )}

      {/* Actions */}
      {(canConfirm || canDispute) && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex gap-3">
          {canConfirm && (
            <Button className="flex-1" onClick={() => confirmMutation.mutate()} loading={confirmMutation.isPending}>
              <CheckCircle className="h-4 w-4" /> Confirm Delivery
            </Button>
          )}
          {canDispute && (
            <Button variant="outline" className="flex-1" onClick={() => disputeMutation.mutate()} loading={disputeMutation.isPending}>
              <AlertTriangle className="h-4 w-4" /> Raise Dispute
            </Button>
          )}
        </motion.div>
      )}
    </div>
  )
}
