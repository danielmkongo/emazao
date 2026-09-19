import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Heart, Share2, Star, MapPin, Package, ChevronLeft,
  CheckCircle2, X, Plus, Minus, Truck, ShieldCheck, ChevronRight,
  AlertTriangle, Check, Leaf, BadgeCheck, MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentForm } from '@/components/payment/PaymentForm'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { FeedProductCard, unitLabel } from '@/components/feed/FeedProductCard'
import { formatCurrency, formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useCart } from '@/hooks/useCart'
import type { ApiResponse, Order, Product, User } from '@/types'

// ─── Order modal ────────────────────────────────────────────────────────────

interface OrderModalProps {
  product: Product
  seller: User
  onClose: () => void
}

interface DeliveryAddress {
  street: string
  city: string
  region: string
  country: string
}

function OrderModal({ product, seller, onClose }: OrderModalProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const minQty = product.minimumOrder ?? 1
  const [qty, setQty] = useState(minQty)
  const [address, setAddress] = useState<DeliveryAddress>({
    street: '',
    city: '',
    region: user?.region ?? '',
    country: user?.country ?? '',
  })
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<'details' | 'confirm' | 'pay' | 'success'>('details')
  const [orderId, setOrderId] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [confirming, setConfirming] = useState(false)

  const subtotal = parseFloat((qty * product.price).toFixed(2))
  const platformFee = parseFloat((subtotal * 0.025).toFixed(2))
  const deliveryFee = 0
  const total = subtotal + platformFee + deliveryFee

  const { mutate: placeOrder, isPending } = useMutation({
    mutationFn: async () => {
      const payload = {
        sellerId: typeof product.sellerId === 'string' ? product.sellerId : (product.sellerId as User)._id,
        items: [{
          productId: product._id,
          title: product.title,
          image: product.images[0] ?? '',
          quantity: qty,
          unit: product.stockUnit ?? product.priceUnit,
          unitPrice: product.price,
          totalPrice: subtotal,
        }],
        deliveryAddress: address,
        notes,
        deliveryFee,
      }
      const res = await api.post<ApiResponse<{ _id: string; orderNumber: string }>>('/orders', payload)
      return res.data.data
    },
    onSuccess: (data) => {
      setOrderId(data._id)
      setOrderNumber(data.orderNumber)
      // Mobile money needs no pre-created intent — the buyer enters their number
      // on the next step and the USSD push is raised from there.
      setStep('pay')
    },
  })

  // Payment confirmation is async (webhook-driven) — poll briefly for the order
  // to actually flip to PAYMENT_CONFIRMED, since the buyer approves the USSD
  // prompt on their handset well after this screen advances.
  const handlePaymentSuccess = () => {
    setStep('success')
    setConfirming(true)
    let attempts = 0
    const poll = setInterval(async () => {
      attempts += 1
      try {
        const res = await api.get<ApiResponse<Order>>(`/orders/${orderId}`)
        if (res.data.data.status !== 'PENDING') {
          setConfirming(false)
          clearInterval(poll)
        }
      } catch { /* keep polling */ }
      if (attempts >= 10) { setConfirming(false); clearInterval(poll) }
    }, 1500)
  }

  const addressFilled = address.street && address.city && address.country

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative w-full max-w-lg bg-[var(--c-card)] rounded-t-3xl sm:rounded-2xl border border-[var(--c-border)] shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--c-border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)]">
          <h2 className="font-bold text-[var(--c-text)] text-lg">
            {step === 'success' ? 'Order Placed!' : step === 'pay' ? 'Payment' : 'Place Order'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--c-input)] transition-colors">
            <X className="h-5 w-5 text-[var(--c-text-3)]" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1 — Quantity + Address */}
          {step === 'details' && (
            <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 space-y-5">
              {/* Product summary */}
              <div className="flex gap-3 items-center p-3 bg-[var(--c-input)] rounded-xl">
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-[var(--c-raised)]">
                  <ImageWithFallback
                    src={product.images[0]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                    fallbackClassName="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--c-text)] text-sm truncate">{product.title}</p>
                  <p className="text-xs text-[var(--c-text-3)] mt-0.5">by {seller.name}</p>
                  <p className="tabular text-brand-green font-bold text-sm mt-1">
                    {formatCurrency(product.price)} {product.priceUnit}
                  </p>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-sm font-medium text-[var(--c-text)] block mb-2">
                  Quantity
                  {product.minimumOrder && (
                    <span className="text-xs text-[var(--c-text-4)] font-normal ml-2">Min. {product.minimumOrder} {product.stockUnit}</span>
                  )}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQty(q => Math.max(minQty, q - (minQty >= 10 ? 10 : 1)))}
                    disabled={qty <= minQty}
                    className="w-9 h-9 rounded-full border border-[var(--c-border)] flex items-center justify-center disabled:opacity-40 hover:bg-[var(--c-input)] transition-colors"
                  >
                    <Minus className="h-4 w-4 text-[var(--c-text)]" />
                  </button>
                  <input
                    type="number"
                    value={qty}
                    min={minQty}
                    onChange={e => setQty(Math.max(minQty, Number(e.target.value)))}
                    className="w-20 text-center bg-[var(--c-input)] border border-[var(--c-border)] rounded-lg py-2 text-[var(--c-text)] font-mono text-sm focus:outline-none focus:border-brand-green"
                  />
                  <button
                    onClick={() => setQty(q => q + (minQty >= 10 ? 10 : 1))}
                    className="w-9 h-9 rounded-full border border-[var(--c-border)] flex items-center justify-center hover:bg-[var(--c-input)] transition-colors"
                  >
                    <Plus className="h-4 w-4 text-[var(--c-text)]" />
                  </button>
                  <span className="text-sm text-[var(--c-text-3)]">{product.stockUnit ?? 'units'}</span>
                </div>
              </div>

              {/* Delivery address */}
              <div>
                <label className="text-sm font-medium text-[var(--c-text)] block mb-2">Delivery Address</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Street / estate / landmark"
                    value={address.street}
                    onChange={e => setAddress(a => ({ ...a, street: e.target.value }))}
                    className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="City / town"
                      value={address.city}
                      onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                      className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green"
                    />
                    <input
                      type="text"
                      placeholder="Region / state"
                      value={address.region}
                      onChange={e => setAddress(a => ({ ...a, region: e.target.value }))}
                      className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Country"
                    value={address.country}
                    onChange={e => setAddress(a => ({ ...a, country: e.target.value }))}
                    className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-[var(--c-text)] block mb-2">Notes for seller <span className="font-normal text-[var(--c-text-4)]">(optional)</span></label>
                <textarea
                  rows={2}
                  placeholder="Special instructions, preferred delivery time..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green resize-none"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!addressFilled}
                onClick={() => setStep('confirm')}
              >
                Review Order <ChevronRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* Step 2 — Review & Confirm */}
          {step === 'confirm' && (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 space-y-5">
              {/* Price breakdown */}
              <div className="bg-[var(--c-input)] rounded-xl p-4 space-y-2.5">
                <h3 className="font-semibold text-[var(--c-text)] text-sm mb-3">Order Summary</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--c-text-3)]">{formatNumber(qty)} {product.stockUnit ?? 'units'} × {formatCurrency(product.price)}</span>
                  <span className="text-[var(--c-text)] tabular">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--c-text-3)]">Platform fee (2.5%)</span>
                  <span className="text-[var(--c-text)] tabular">{formatCurrency(platformFee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--c-text-3)] flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Delivery</span>
                  <span className="text-brand-green tabular text-sm">TBD by seller</span>
                </div>
                <div className="border-t border-[var(--c-border)] pt-2.5 flex justify-between">
                  <span className="font-bold text-[var(--c-text)]">Total</span>
                  <span className="font-bold text-[var(--c-text)] tabular text-lg">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Delivery address summary */}
              <div className="bg-[var(--c-input)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-brand-green" />
                  <span className="text-sm font-medium text-[var(--c-text)]">Delivery to</span>
                </div>
                <p className="text-sm text-[var(--c-text-2)]">
                  {address.street}, {address.city}, {address.region}, {address.country}
                </p>
                {notes && <p className="text-xs text-[var(--c-text-3)] mt-2 italic">"{notes}"</p>}
              </div>

              {/* Trust signal */}
              <div className="flex items-center gap-2 text-xs text-[var(--c-text-3)] bg-brand-green/5 border border-brand-green/15 rounded-xl px-3 py-2.5">
                <ShieldCheck className="h-4 w-4 text-brand-green shrink-0" />
                Your payment is protected by Emazao Escrow until delivery is confirmed.
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep('details')}>Back</Button>
                <Button className="flex-[2]" onClick={() => placeOrder()} disabled={isPending}>
                  {isPending ? 'Placing order…' : `Continue to Payment ${formatCurrency(total)}`}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3 — Payment */}
          {step === 'pay' && orderId && (
            <motion.div key="pay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs text-[var(--c-text-3)] bg-brand-green/5 border border-brand-green/15 rounded-xl px-3 py-2.5">
                <ShieldCheck className="h-4 w-4 text-brand-green shrink-0" />
                Your payment is protected by Emazao Escrow until delivery is confirmed.
              </div>
              <PaymentForm orderId={orderId} onSuccess={handlePaymentSuccess} />
            </motion.div>
          )}

          {/* Step 4 — Success */}
          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-brand-green/10 border-2 border-brand-green flex items-center justify-center mx-auto mb-5"
              >
                <CheckCircle2 className="h-10 w-10 text-brand-green" />
              </motion.div>
              <h3 className="text-xl font-bold text-[var(--c-text)] mb-2">{confirming ? 'Confirming payment…' : 'Payment Confirmed!'}</h3>
              <p className="text-[var(--c-text-3)] text-sm mb-1">Order <span className="font-mono text-[var(--c-text)]">{orderNumber}</span></p>
              <p className="text-[var(--c-text-3)] text-sm mb-8">
                {confirming
                  ? "We're confirming your payment with your bank. This can take a few seconds."
                  : "The seller has been notified and will prepare your order for shipment."}
              </p>
              <div className="flex flex-col gap-3">
                <Button className="w-full" onClick={() => navigate('/orders')}>
                  Track Order
                </Button>
                <Button variant="outline" className="w-full" onClick={onClose}>
                  Continue Shopping
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user: me } = useAuthStore()
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [slide, setSlide] = useState(0)
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [shared, setShared] = useState(false)
  const galleryRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => (await api.get<ApiResponse<Product & { userSaved?: boolean }>>(`/products/${slug}`)).data.data,
    retry: 1,
  })
  useEffect(() => { if (data) setSaved(!!data.userSaved) }, [data?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  const sellerId = data ? (typeof data.sellerId === 'string' ? data.sellerId : (data.sellerId as User)._id) : undefined
  const { data: moreFromFarm } = useQuery({
    queryKey: ['more-from-farm', sellerId],
    queryFn: async () => (await api.get<ApiResponse<Product[]>>(`/products?sellerId=${sellerId}&limit=12`)).data.data ?? [],
    enabled: !!sellerId,
    staleTime: 60_000,
  })

  const handleSave = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    const next = !saved
    setSaved(next)
    try { await api.post('/social/save', { targetId: data?._id, targetType: 'Product' }) }
    catch { setSaved(!next) }
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: data?.title, url })
      else { await navigator.clipboard.writeText(url); setShared(true); window.setTimeout(() => setShared(false), 1600) }
    } catch { /* dismissed */ }
  }

  const handleBuyNow = () => {
    if (!isAuthenticated) { navigate('/login'); return }
    setShowBuyModal(true)
  }

  // Add to cart collects items across sellers for one combined payment; Buy
  // Now stays for the single-product purchase that does not need a cart.
  const { add: addToCart } = useCart()
  const [added, setAdded] = useState(false)
  const handleAddToCart = () => {
    if (!isAuthenticated) { navigate('/login'); return }
    if (!data) return
    addToCart.mutate(
      { productId: data._id, quantity: data.minimumOrder ?? 1 },
      { onSuccess: () => { setAdded(true); setTimeout(() => setAdded(false), 2500) } },
    )
  }

  const goTo = (i: number) => {
    const el = galleryRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  if (isLoading) return (
    <div className="max-w-5xl mx-auto md:px-6 md:py-8">
      <div className="grid md:grid-cols-2 md:gap-10">
        <div className="aspect-square md:rounded-3xl skeleton-shimmer" />
        <div className="p-4 md:p-0 space-y-4">
          <div className="h-9 w-40 rounded-lg skeleton-shimmer" />
          <div className="h-6 w-3/4 rounded-lg skeleton-shimmer" />
          <div className="h-24 rounded-xl skeleton-shimmer" />
        </div>
      </div>
    </div>
  )

  if (isError) return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <h2 className="text-xl font-semibold text-[var(--c-text)] mb-2">Failed to load product</h2>
      <p className="text-[var(--c-text-3)] mb-6 text-sm max-w-sm">
        {(error as any)?.response?.data?.message || (error as Error)?.message || 'An unexpected error occurred.'}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        <Link to="/marketplace"><Button>Browse the market</Button></Link>
      </div>
    </div>
  )

  if (!data) return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <Package className="h-12 w-12 text-[var(--c-text-4)] mb-4" />
      <h2 className="text-xl font-semibold text-[var(--c-text)] mb-2">Product not found</h2>
      <p className="text-[var(--c-text-3)] mb-6">This product may have been removed or the link is invalid.</p>
      <Link to="/marketplace"><Button>Browse the market</Button></Link>
    </div>
  )

  const seller = data.sellerId as User
  const images = data.images?.length ? data.images : ['']
  const outOfStock = data.status === 'OUT_OF_STOCK'
  const isOwn = me?._id === seller?._id
  const unit = unitLabel(data.priceUnit)
  const others = (moreFromFarm ?? []).filter(p => p._id !== data._id)
  const certifications: string[] = (data as any).certifications ?? []
  const longDescription = (data.description?.length ?? 0) > 220

  const messageSeller = () => {
    if (!isAuthenticated) { navigate('/login'); return }
    navigate(`/messages/new?recipientId=${seller._id}`, { state: { recipient: seller } })
  }

  const roundBtn = 'w-10 h-10 rounded-full bg-white/90 dark:bg-black/60 text-black flex items-center justify-center shadow-md backdrop-blur press'

  return (
    <>
      <div className="max-w-5xl mx-auto md:px-6 md:py-8 pb-[calc(88px+env(safe-area-inset-bottom,0px))] md:pb-10">
        <div className="grid md:grid-cols-2 md:gap-10 md:items-start">
          {/* ── Gallery ─────────────────────────────────────────── */}
          <div className="md:sticky md:top-8">
            <div className="relative aspect-square md:rounded-3xl overflow-hidden bg-[var(--c-input)]">
              <div ref={galleryRef} className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                onScroll={e => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
                {images.map((src, i) => (
                  <div key={i} className="w-full h-full flex-shrink-0 snap-center">
                    <ImageWithFallback src={src} alt={i === 0 ? data.title : ''} loading={i === 0 ? 'eager' : 'lazy'}
                      className="w-full h-full object-cover" fallbackClassName="w-full h-full" />
                  </div>
                ))}
              </div>

              <button onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/marketplace'))} aria-label="Back"
                className={`absolute top-3 left-3 ${roundBtn}`}>
                <ChevronLeft className="h-5 w-5 dark:text-white" />
              </button>
              <div className="absolute top-3 right-3 flex gap-2">
                <button onClick={handleShare} aria-label="Share" className={roundBtn}>
                  {shared ? <Check className="h-[18px] w-[18px] text-brand-green" /> : <Share2 className="h-[18px] w-[18px] dark:text-white" />}
                </button>
                <button onClick={handleSave} aria-label={saved ? 'Saved' : 'Save'} aria-pressed={saved} className={roundBtn}>
                  <Heart className={`h-[18px] w-[18px] ${saved ? 'fill-red-500 text-red-500' : 'dark:text-white'}`} />
                </button>
              </div>

              {images.length > 1 && (
                <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => goTo(i)} aria-label={`Photo ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />
                  ))}
                </div>
              )}
              {data.isBoosted && (
                <span className="absolute bottom-3 left-3 text-[10.5px] font-bold uppercase tracking-wide bg-black/55 text-white px-2 py-0.5 rounded-full backdrop-blur">Sponsored</span>
              )}
            </div>

            {images.length > 1 && (
              <div className="hidden md:flex gap-2 mt-3">
                {images.slice(0, 6).map((img, i) => (
                  <button key={i} onClick={() => goTo(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === slide ? 'border-[var(--c-text)]' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                    <ImageWithFallback src={img} alt="" className="w-full h-full object-cover" fallbackClassName="w-full h-full" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Details ─────────────────────────────────────────── */}
          <div className="px-4 pt-4 md:p-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[30px] font-extrabold text-[var(--c-text)] tabular leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                {formatCurrency(data.price)}
              </span>
              <span className="text-[15px] text-[var(--c-text-3)]">/ {unit}</span>
            </div>
            <h1 className="text-[19px] md:text-[22px] font-semibold text-[var(--c-text)] leading-snug mt-2">{data.title}</h1>

            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-2 text-[13.5px] text-[var(--c-text-3)]">
              {(data.ratingCount ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[var(--c-text)]">
                  <Star className="h-4 w-4 fill-gold text-gold" /><b className="font-semibold">{data.rating.toFixed(1)}</b>
                  <span className="text-[var(--c-text-3)]">({data.ratingCount})</span>
                </span>
              )}
              {(data.orderCount ?? 0) > 0 && <span>{formatNumber(data.orderCount)} sold</span>}
              <span>{formatNumber(data.viewCount ?? 0)} views</span>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {data.isOrganic && <Pill tone="green"><Leaf className="h-3.5 w-3.5" />Organic</Pill>}
              {data.condition && <Pill>{data.condition.charAt(0) + data.condition.slice(1).toLowerCase()}</Pill>}
              {data.origin && <Pill><MapPin className="h-3.5 w-3.5" />{data.origin}</Pill>}
              {data.availableStock != null && !outOfStock && <Pill><Package className="h-3.5 w-3.5" />{formatNumber(data.availableStock)} {data.stockUnit ?? unit} in stock</Pill>}
              {outOfStock && <Pill tone="red">Sold out</Pill>}
              {(data.minimumOrder ?? 0) > 1 && <Pill>Min. order {data.minimumOrder} {data.stockUnit ?? unit}</Pill>}
            </div>

            {/* Seller */}
            <div className="flex items-center gap-3 mt-5 py-3 border-y border-[var(--c-border)]">
              <Link to={`/profile/${seller?.username}`} className="flex-shrink-0">
                <Avatar src={seller?.avatar} name={seller?.name} size="lg" />
              </Link>
              <Link to={`/farm/${seller?.username}`} className="flex-1 min-w-0">
                <span className="flex items-center gap-1 text-[15px] font-semibold text-[var(--c-text)]">
                  <span className="truncate">{seller?.name}</span>
                  {seller?.isVerified && <BadgeCheck className="h-4 w-4 text-white fill-brand-green flex-shrink-0" />}
                </span>
                <span className="text-[13px] text-[var(--c-text-3)] flex items-center gap-1">
                  {seller?.country && <><MapPin className="h-3 w-3" />{[seller.region, seller.country].filter(Boolean).join(', ')} · </>}Visit shop
                </span>
              </Link>
              {!isOwn && (
                <button onClick={messageSeller} className="h-9 px-3.5 rounded-lg bg-[var(--c-input)] hover:bg-[var(--c-raised)] text-[13.5px] font-semibold text-[var(--c-text)] flex items-center gap-1.5 press">
                  <MessageCircle className="h-4 w-4" /> Ask
                </button>
              )}
            </div>

            {/* Why it is safe to pay */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-brand-green/[0.07]">
                <ShieldCheck className="h-5 w-5 text-brand-green flex-shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-[var(--c-text-2)] leading-snug"><b className="text-[var(--c-text)] font-semibold">Protected payment.</b> Your money is held until you confirm delivery.</p>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[var(--c-input)]">
                <Truck className="h-5 w-5 text-[var(--c-text-2)] flex-shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-[var(--c-text-2)] leading-snug"><b className="text-[var(--c-text)] font-semibold">Track every step</b> from dispatch to your door.</p>
              </div>
            </div>

            {/* Description */}
            {data.description && (
              <div className="mt-5">
                <h2 className="text-[15px] font-bold text-[var(--c-text)] mb-1.5">About this product</h2>
                <p className={`text-[14.5px] text-[var(--c-text-2)] leading-relaxed whitespace-pre-line ${!expanded && longDescription ? 'line-clamp-4' : ''}`}>{data.description}</p>
                {longDescription && (
                  <button onClick={() => setExpanded(e => !e)} className="text-[14px] font-semibold text-[var(--c-text)] mt-1">{expanded ? 'Less' : 'More'}</button>
                )}
              </div>
            )}

            {certifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {certifications.map(c => <Pill key={c} tone="green"><CheckCircle2 className="h-3.5 w-3.5" />{c}</Pill>)}
              </div>
            )}
            {data.tags?.length > 0 && (
              <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-3">
                {data.tags.map(tag => (
                  <Link key={tag} to={`/explore?q=${encodeURIComponent(tag)}`} className="text-[13.5px] text-brand-green hover:underline">#{tag}</Link>
                ))}
              </div>
            )}

            {/* Desktop actions */}
            {!isOwn && (
              <div className="hidden md:flex gap-3 mt-7">
                <ActionButtons outOfStock={outOfStock} added={added} adding={addToCart.isPending}
                  onAdd={added ? () => navigate('/cart') : handleAddToCart} onBuy={handleBuyNow} />
              </div>
            )}
          </div>
        </div>

        {/* More from this farm */}
        {others.length > 0 && (
          <section className="mt-9">
            <div className="flex items-center justify-between px-4 md:px-0 mb-3">
              <h2 className="text-[17px] font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-display)' }}>More from {seller?.name?.split(' ')[0]}</h2>
              <Link to={`/farm/${seller?.username}`} className="text-[13.5px] font-semibold text-brand-green flex items-center">Visit shop<ChevronRight className="h-4 w-4" /></Link>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-0 snap-x scroll-px-4">
              {others.map(p => <div key={p._id} className="w-[160px] flex-shrink-0 snap-start"><FeedProductCard product={p} /></div>)}
            </div>
          </section>
        )}
      </div>

      {/* Phone: a buy bar that sits on the tab bar, never over the content */}
      {!isOwn && (
        <div className="md:hidden fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-20 bar-surface border-t border-[var(--c-border)] px-3 py-2.5 flex items-center gap-2">
          <ActionButtons outOfStock={outOfStock} added={added} adding={addToCart.isPending}
            onAdd={added ? () => navigate('/cart') : handleAddToCart} onBuy={handleBuyNow} />
        </div>
      )}

      <AnimatePresence>
        {showBuyModal && data && (
          <OrderModal product={data} seller={seller} onClose={() => setShowBuyModal(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'green' | 'red' }) {
  const c = tone === 'green' ? 'bg-brand-green/10 text-brand-green' : tone === 'red' ? 'bg-red-500/10 text-red-500' : 'bg-[var(--c-input)] text-[var(--c-text-2)]'
  return <span className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12.5px] font-medium ${c}`}>{children}</span>
}

function ActionButtons({ outOfStock, added, adding, onAdd, onBuy }: {
  outOfStock: boolean; added: boolean; adding: boolean; onAdd: () => void; onBuy: () => void
}) {
  return (
    <>
      <button onClick={onAdd} disabled={outOfStock || adding}
        className="flex-1 min-w-0 h-12 rounded-xl border-2 border-[var(--c-text)] text-[var(--c-text)] text-[15px] font-bold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-40 press">
        {added ? <Check className="h-5 w-5 text-brand-green" /> : <ShoppingCart className="h-5 w-5" />}
        {adding ? 'Adding…' : added ? 'View cart' : 'Add to cart'}
      </button>
      <button onClick={onBuy} disabled={outOfStock}
        className="flex-1 min-w-0 h-12 rounded-xl bg-brand-green hover:bg-brand-emerald text-white text-[15px] font-bold whitespace-nowrap disabled:opacity-40 press">
        {outOfStock ? 'Sold out' : 'Buy now'}
      </button>
    </>
  )
}
