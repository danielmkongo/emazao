import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Package, MapPin, CheckCircle, AlertTriangle, Truck, Clock, CreditCard, Copy, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ReviewDialog } from '@/components/reviews/ReviewDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/ui/avatar'
import { PaymentForm } from '@/components/payment/PaymentForm'
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

  const [paying, setPaying] = useState(false)

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

  // Dispatching issues the tracking number and opens the shipment's event
  // history — a plain status flip to SHIPPED gave the buyer nothing to follow.
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  // Only invite a review the server will actually accept. Without this the
  // prompt stayed up after the buyer had reviewed, and pressing it again just
  // produced "You have already reviewed this order".
  const { data: reviewable } = useQuery({
    queryKey: ['reviewable'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { _id: string }[] }>('/reviews/reviewable')
      return res.data.data ?? []
    },
  })
  const canReview = Boolean(reviewable?.some(r => r._id === id))
  const [carrier, setCarrier] = useState('')
  const [dispatchNote, setDispatchNote] = useState('')

  const dispatchMutation = useMutation({
    mutationFn: () => api.post(`/orders/${id}/dispatch`, {
      carrier: carrier.trim() || undefined,
      note: dispatchNote.trim() || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      setDispatchOpen(false)
    },
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
  const canPay = isBuyer && order.status === 'PENDING'

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

      {/* Abandoned/incomplete payment recovery */}
      {canPay && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 mb-4">
          {paying ? (
            <>
              <h3 className="font-semibold text-[var(--c-text)] mb-3">Complete Payment</h3>
              {order.checkoutId && (
                <p className="text-[var(--c-text-3)] text-sm mb-3">
                  This order was placed together with others from your cart, so this pays for all of them in one go.
                </p>
              )}
              <PaymentForm
                {...(order.checkoutId ? { checkoutId: String(order.checkoutId) } : { orderId: String(id) })}
                onSuccess={() => {
                  setPaying(false)
                  queryClient.invalidateQueries({ queryKey: ['order', id] })
                }}
                onCancel={() => setPaying(false)}
              />
            </>
          ) : (
            <Button className="w-full" onClick={() => setPaying(true)}>
              <CreditCard className="h-4 w-4" />
              Complete Payment
            </Button>
          )}
        </motion.div>
      )}

      {/* Actions */}
      {/* Rate the seller once the goods have arrived. */}
      {isBuyer && canReview && (
        <div className="flex items-center justify-between gap-3 bg-amber-400/[0.08] border border-amber-400/30 rounded-2xl p-4 mb-4">
          <div>
            <p className="text-[var(--c-text)] font-semibold text-sm">How was {seller?.name ?? 'the seller'}?</p>
            <p className="text-[var(--c-text-3)] text-xs mt-0.5">Your review helps other buyers decide who to trust.</p>
          </div>
          <Button size="sm" onClick={() => setReviewOpen(true)}>Rate seller</Button>
        </div>
      )}

      {/* Shipment tracking — shown once the order has actually been dispatched. */}
      {order.trackingNumber && (
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4 mb-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[var(--c-text-3)] text-xs uppercase tracking-wider mb-1">Tracking number</p>
              <p className="font-mono font-semibold text-[var(--c-text)] break-all">{order.trackingNumber}</p>
              {order.carrier && <p className="text-[var(--c-text-3)] text-sm mt-0.5">{order.carrier}</p>}
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(order.trackingNumber!)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--c-raised)] text-[var(--c-text-2)] text-xs font-medium hover:text-[var(--c-text)] transition-colors"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>

          {!!order.trackingEvents?.length && (
            <ol className="relative border-l border-[var(--c-border)] ml-1.5 space-y-3 pt-1">
              {[...order.trackingEvents].reverse().map((e, i) => (
                <li key={i} className="pl-4 relative">
                  <span className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${i === 0 ? 'bg-brand-green' : 'bg-[var(--c-border)]'}`} />
                  <p className={`text-sm font-medium ${i === 0 ? 'text-[var(--c-text)]' : 'text-[var(--c-text-2)]'}`}>
                    {e.status.replace(/_/g, ' ')}
                    {e.location && <span className="text-[var(--c-text-3)] font-normal"> · {e.location}</span>}
                  </p>
                  {e.note && <p className="text-[var(--c-text-3)] text-xs mt-0.5">{e.note}</p>}
                  <p className="text-[var(--c-text-4)] text-[11px] mt-0.5">{new Date(e.at).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {(canConfirm || canDispute || canMarkShipped) && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="flex gap-3">
          {canMarkShipped && (
            <Button className="flex-1" onClick={() => setDispatchOpen(true)} disabled={dispatchMutation.isPending}>
              <Truck className="h-4 w-4" />
              {dispatchMutation.isPending ? 'Dispatching…' : 'Dispatch order'}
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

      {reviewOpen && (
        <ReviewDialog
          orderId={order._id}
          orderNumber={order.orderNumber}
          sellerName={seller?.name ?? 'the seller'}
          sellerId={seller?._id}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {/* Dispatch dialog */}
      {dispatchOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDispatchOpen(false)} />
          <div className="relative w-full max-w-md bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl shadow-2xl p-5 z-10">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-semibold text-[var(--c-text)]">Dispatch this order</h2>
                <p className="text-[var(--c-text-3)] text-sm mt-0.5">
                  A tracking number is issued and the buyer is notified.
                </p>
              </div>
              <button onClick={() => setDispatchOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block text-[var(--c-text-2)] text-sm font-medium mb-1.5">Carrier</label>
            <input
              value={carrier}
              onChange={e => setCarrier(e.target.value)}
              placeholder="DHL, Posta, own transport…"
              className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] mb-3 focus:outline-none focus:border-brand-green"
            />

            <label className="block text-[var(--c-text-2)] text-sm font-medium mb-1.5">Note <span className="text-[var(--c-text-4)] font-normal">(optional)</span></label>
            <textarea
              rows={2}
              value={dispatchNote}
              onChange={e => setDispatchNote(e.target.value)}
              placeholder="Left Arusha depot this morning"
              className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] mb-4 focus:outline-none focus:border-brand-green"
            />

            {dispatchMutation.isError && (
              <p className="text-red-500 text-sm mb-3">
                {(dispatchMutation.error as any)?.response?.data?.message ?? 'Could not dispatch this order.'}
              </p>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => dispatchMutation.mutate()} disabled={dispatchMutation.isPending}>
                <Truck className="h-4 w-4" />
                {dispatchMutation.isPending ? 'Dispatching…' : 'Dispatch'}
              </Button>
              <Button variant="secondary" onClick={() => setDispatchOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
