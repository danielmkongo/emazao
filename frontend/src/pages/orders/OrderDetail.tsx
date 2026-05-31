import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Package, MapPin, CheckCircle, AlertTriangle, Truck, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/ui/avatar'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, Order, User } from '@/types'

const statusVariant: Record<string, 'default' | 'gold' | 'organic' | 'urgent' | 'outline'> = {
  PENDING: 'outline', PAYMENT_CONFIRMED: 'gold', PROCESSING: 'gold',
  SHIPPED: 'organic', DELIVERED: 'default', COMPLETED: 'default',
  CANCELLED: 'urgent', REFUNDED: 'outline', DISPUTED: 'urgent',
}

const STATUS_STEPS = ['PENDING', 'PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

function StatusTracker({ status }: { status: string }) {
  const steps = [
    { key: 'PENDING', label: 'Placed', icon: Clock },
    { key: 'PROCESSING', label: 'Processing', icon: Package },
    { key: 'SHIPPED', label: 'Shipped', icon: Truck },
    { key: 'COMPLETED', label: 'Delivered', icon: CheckCircle },
  ]
  const currentIdx = STATUS_STEPS.indexOf(status)
  const isDone = (stepKey: string) => STATUS_STEPS.indexOf(stepKey) <= currentIdx

  if (['CANCELLED', 'DISPUTED', 'REFUNDED'].includes(status)) return null

  return (
    <div className="flex items-center gap-0 w-full mb-6">
      {steps.map((step, i) => {
        const done = isDone(step.key)
        const Icon = step.icon
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                done ? 'bg-brand-green border-brand-green' : 'bg-[var(--c-input)] border-[var(--c-border)]'
              }`}>
                <Icon className={`h-3.5 w-3.5 ${done ? 'text-white' : 'text-[var(--c-text-4)]'}`} />
              </div>
              <span className={`text-xs mt-1 ${done ? 'text-brand-green font-medium' : 'text-[var(--c-text-4)]'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 -mt-4 ${done && isDone(steps[i + 1].key) ? 'bg-brand-green' : 'bg-[var(--c-border)]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Order>>(`/orders/${id}`)
      return res.data.data
    },
    retry: 1,
  })

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/orders/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const disputeMutation = useMutation({
    mutationFn: () => api.post(`/orders/${id}/dispute`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const markShippedMutation = useMutation({
    mutationFn: () => api.put(`/orders/${id}/status`, { status: 'SHIPPED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
  )

  if (isError) return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <h2 className="text-xl font-semibold text-[var(--c-text)] mb-2">Failed to load order</h2>
      <p className="text-[var(--c-text-3)] mb-6 text-sm max-w-sm">
        {(error as any)?.response?.data?.message || (error as Error)?.message || 'Order not found or access denied.'}
      </p>
      <Button onClick={() => navigate('/orders')}>Back to Orders</Button>
    </div>
  )

  if (!order) return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mb-4">
        <Package className="h-8 w-8 text-[var(--c-text-4)]" />
      </div>
      <h2 className="text-xl font-semibold text-[var(--c-text)] mb-2">Order not found</h2>
      <Button onClick={() => navigate('/orders')}>Back to Orders</Button>
    </div>
  )

  const seller = order.sellerId as unknown as User
  const buyer = order.buyerId as unknown as User
  const isBuyer = user?._id === (typeof order.buyerId === 'string' ? order.buyerId : buyer?._id)
  const isSeller = user?._id === (typeof order.sellerId === 'string' ? order.sellerId : seller?._id)
  const canConfirm = isBuyer && order.status === 'SHIPPED'
  const canDispute = isBuyer && ['SHIPPED', 'DELIVERED'].includes(order.status)
  const canMarkShipped = isSeller && (order.status === 'PAYMENT_CONFIRMED' || order.status === 'PROCESSING')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[var(--c-text-3)] hover:text-[var(--c-text)] mb-6 transition-colors text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="font-mono text-xs text-[var(--c-text-3)] mb-1">{order.orderNumber}</p>
          <p className="text-[var(--c-text)] font-bold text-xl">Order Details</p>
          <p className="text-[var(--c-text-3)] text-xs mt-0.5">{timeAgo(order.createdAt)}</p>
        </div>
        <Badge variant={statusVariant[order.status] ?? 'outline'} className="text-sm px-4 py-1">
          {order.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      {/* Status tracker */}
      <StatusTracker status={order.status} />

      {/* Seller / Buyer info */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-4 mb-4">
        <p className="text-xs text-[var(--c-text-4)] font-medium uppercase tracking-wide mb-3">
          {isBuyer ? 'Seller' : 'Buyer'}
        </p>
        <div className="flex items-center gap-3">
          <Avatar
            src={isBuyer ? seller?.avatar : buyer?.avatar}
            name={isBuyer ? seller?.name : buyer?.name}
            size="md"
            verified={isBuyer ? seller?.isVerified : buyer?.isVerified}
          />
          <div>
            <p className="font-semibold text-[var(--c-text)] text-sm">{isBuyer ? seller?.name : buyer?.name}</p>
            <p className="text-xs text-[var(--c-text-3)]">{isBuyer ? seller?.country : buyer?.country}</p>
          </div>
        </div>
      </motion.div>

      {/* Items */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
        className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 mb-4">
        <h3 className="font-semibold text-[var(--c-text)] mb-4">Items</h3>
        <div className="space-y-3">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl overflow-hidden bg-[var(--c-input)] flex-shrink-0">
                {item.image
                  ? <img src={item.image} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Package className="h-5 w-5 text-[var(--c-text-4)]" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[var(--c-text)] font-medium text-sm">{item.title}</p>
                <p className="text-[var(--c-text-3)] text-xs">{item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}</p>
              </div>
              <p className="text-[var(--c-text)] font-semibold font-mono text-sm">{formatCurrency(item.totalPrice)}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--c-border)] space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--c-text-3)]">Subtotal</span>
            <span className="text-[var(--c-text)] font-mono">{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--c-text-3)]">Delivery</span>
            <span className="text-[var(--c-text)] font-mono">{formatCurrency(order.deliveryFee)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--c-text-3)]">Platform fee (2.5%)</span>
            <span className="text-[var(--c-text)] font-mono">{formatCurrency(order.platformFee)}</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t border-[var(--c-border)]">
            <span className="text-[var(--c-text)]">Total</span>
            <span className="text-[var(--c-text)] font-mono">{formatCurrency(order.total)}</span>
          </div>
        </div>
      </motion.div>

      {/* Delivery Address */}
      {order.deliveryAddress && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 mb-4">
          <h3 className="font-semibold text-[var(--c-text)] mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-green" />Delivery Address
          </h3>
          <p className="text-[var(--c-text-2)] text-sm">{order.deliveryAddress.street}</p>
          <p className="text-[var(--c-text-2)] text-sm">{order.deliveryAddress.city}, {order.deliveryAddress.region}</p>
          <p className="text-[var(--c-text-2)] text-sm">{order.deliveryAddress.country}</p>
        </motion.div>
      )}

      {/* Actions */}
      {(canConfirm || canDispute || canMarkShipped) && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="flex gap-3">
          {canMarkShipped && (
            <Button className="flex-1" onClick={() => markShippedMutation.mutate()} disabled={markShippedMutation.isPending}>
              <Truck className="h-4 w-4" />
              {markShippedMutation.isPending ? 'Updating…' : 'Mark as Shipped'}
            </Button>
          )}
          {canConfirm && (
            <Button className="flex-1" onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
              <CheckCircle className="h-4 w-4" />
              {confirmMutation.isPending ? 'Confirming…' : 'Confirm Delivery'}
            </Button>
          )}
          {canDispute && (
            <Button variant="outline" onClick={() => disputeMutation.mutate()} disabled={disputeMutation.isPending}>
              <AlertTriangle className="h-4 w-4" />
              {disputeMutation.isPending ? '…' : 'Dispute'}
            </Button>
          )}
        </motion.div>
      )}
    </div>
  )
}
