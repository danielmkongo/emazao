import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Heart, Share2, Star, MapPin, Package, ChevronLeft,
  CheckCircle2, X, Plus, Minus, Truck, ShieldCheck, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { ApiResponse, Product, User } from '@/types'

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
  const [step, setStep] = useState<'details' | 'confirm' | 'success'>('details')
  const [orderNumber, setOrderNumber] = useState('')

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
      setOrderNumber(data.orderNumber)
      setStep('success')
    },
  })

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
            {step === 'success' ? 'Order Placed!' : 'Place Order'}
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
                  {product.images[0]
                    ? <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">🌾</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--c-text)] text-sm truncate">{product.title}</p>
                  <p className="text-xs text-[var(--c-text-3)] mt-0.5">by {seller.name}</p>
                  <p className="text-brand-green font-bold text-sm mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
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
                  <span className="text-[var(--c-text)] font-mono">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--c-text-3)]">Platform fee (2.5%)</span>
                  <span className="text-[var(--c-text)] font-mono">{formatCurrency(platformFee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--c-text-3)] flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Delivery</span>
                  <span className="text-brand-green font-mono text-sm">TBD by seller</span>
                </div>
                <div className="border-t border-[var(--c-border)] pt-2.5 flex justify-between">
                  <span className="font-bold text-[var(--c-text)]">Total</span>
                  <span className="font-bold text-[var(--c-text)] font-mono text-lg">{formatCurrency(total)}</span>
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
                  {isPending ? 'Placing order…' : `Confirm & Pay ${formatCurrency(total)}`}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3 — Success */}
          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-brand-green/10 border-2 border-brand-green flex items-center justify-center mx-auto mb-5"
              >
                <CheckCircle2 className="h-10 w-10 text-brand-green" />
              </motion.div>
              <h3 className="text-xl font-bold text-[var(--c-text)] mb-2">Order Placed!</h3>
              <p className="text-[var(--c-text-3)] text-sm mb-1">Order <span className="font-mono text-[var(--c-text)]">{orderNumber}</span></p>
              <p className="text-[var(--c-text-3)] text-sm mb-8">The seller has been notified. You'll receive a confirmation once they confirm the order.</p>
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
  const { isAuthenticated } = useAuthStore()
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [saved, setSaved] = useState(false)
  const [savedInitialized, setSavedInitialized] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product & { userSaved?: boolean }>>(`/products/${slug}`)
      return res.data.data
    },
    retry: 1,
  })

  // Initialize saved state from server once data loads
  if (data && !savedInitialized) {
    setSaved(!!(data as any).userSaved)
    setSavedInitialized(true)
  }

  const handleSave = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    setSaved(s => !s)
    try {
      const res = await api.post<{ success: boolean; saved: boolean }>('/social/save', { productId: data?._id })
      setSaved(res.data.saved)
    } catch {
      setSaved(s => !s)
    }
  }

  const handleShare = async () => {
    try {
      await navigator.share({ title: data?.title, url: window.location.href })
    } catch {
      navigator.clipboard.writeText(window.location.href)
    }
  }

  const handleBuyNow = () => {
    if (!isAuthenticated) { navigate('/login'); return }
    setShowBuyModal(true)
  }

  if (isLoading) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Skeleton className="h-6 w-32 mb-6 rounded-lg" />
      <div className="grid md:grid-cols-2 gap-8">
        <Skeleton className="aspect-square rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4 rounded-xl" />
          <Skeleton className="h-6 w-1/2 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
    </div>
  )

  if (isError) return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <span className="text-6xl mb-4">⚠️</span>
      <h2 className="text-xl font-semibold text-[var(--c-text)] mb-2">Failed to load product</h2>
      <p className="text-[var(--c-text-3)] mb-2 text-sm max-w-sm">
        {(error as any)?.response?.data?.message || (error as Error)?.message || 'An unexpected error occurred.'}
      </p>
      <p className="text-[var(--c-text-4)] text-xs mb-6">ID: {slug}</p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        <Link to="/marketplace"><Button>Browse Marketplace</Button></Link>
      </div>
    </div>
  )

  if (!data) return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <span className="text-6xl mb-4">🔍</span>
      <h2 className="text-xl font-semibold text-[var(--c-text)] mb-2">Product not found</h2>
      <p className="text-[var(--c-text-3)] mb-6">This product may have been removed or the link is invalid.</p>
      <Link to="/marketplace"><Button>Browse Marketplace</Button></Link>
    </div>
  )

  const seller = data.sellerId as User
  const images = data.images.length > 0 ? data.images : []

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-8">
        {/* Back */}
        <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-text-3)] hover:text-brand-green transition-colors mb-6">
          <ChevronLeft className="h-4 w-4" /> Back to Marketplace
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid md:grid-cols-2 gap-8">
          {/* Image gallery */}
          <div className="space-y-3">
            <div className="aspect-square rounded-2xl overflow-hidden bg-[var(--c-input)] relative">
              {images[selectedImage] ? (
                <img
                  src={images[selectedImage]}
                  alt={data.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">🌾</div>
              )}
              {data.isBoosted && (
                <span className="absolute top-3 left-3 text-xs font-semibold bg-gold text-black px-2 py-0.5 rounded-full">
                  Featured
                </span>
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {images.slice(0, 4).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${i === selectedImage ? 'border-brand-green' : 'border-transparent'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              {data.isOrganic && <Badge variant="organic">Organic</Badge>}
              {data.condition && <Badge variant="outline">{data.condition}</Badge>}
              {data.status === 'OUT_OF_STOCK' && <Badge variant="urgent">Out of Stock</Badge>}
            </div>

            <h1 className="text-2xl font-bold text-[var(--c-text)] mb-2">{data.title}</h1>

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(data.price)}
              </span>
              <span className="text-[var(--c-text-3)] text-sm">{data.priceUnit}</span>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 mb-5 text-sm text-[var(--c-text-3)]">
              {(data.ratingCount ?? 0) > 0 && (
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  <span className="font-semibold text-[var(--c-text)]">{(data.rating ?? 0).toFixed(1)}</span>
                  <span className="text-[var(--c-text-4)]">({data.ratingCount} reviews)</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Package className="h-4 w-4" />
                {formatNumber(data.availableStock ?? 0)} {data.stockUnit} available
              </span>
              <span>{formatNumber(data.viewCount)} views</span>
            </div>

            <p className="text-[var(--c-text-2)] text-sm leading-relaxed mb-6">{data.description}</p>

            {/* Tags */}
            {data.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {data.tags.map(tag => (
                  <span key={tag} className="text-xs px-2.5 py-1 bg-[var(--c-input)] border border-[var(--c-border)] rounded-full text-[var(--c-text-3)]">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Certifications */}
            {(data as any).certifications?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {(data as any).certifications.map((cert: string) => (
                  <span key={cert} className="flex items-center gap-1.5 text-xs bg-brand-green/8 text-brand-green border border-brand-green/20 rounded-full px-3 py-1">
                    <CheckCircle2 className="h-3 w-3" /> {cert}
                  </span>
                ))}
              </div>
            )}

            {/* Seller card */}
            <div className="flex items-center gap-3 p-3.5 bg-[var(--c-input)] rounded-xl mb-5 border border-[var(--c-border)]">
              <Avatar src={seller?.avatar} name={seller?.name} size="md" verified={seller?.isVerified} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--c-text)] text-sm">{seller?.name}</p>
                <p className="text-xs text-[var(--c-text-3)] flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />{seller?.country}
                </p>
              </div>
              <Link to={`/farm/${seller?.username}`}>
                <Button variant="outline" size="sm">View Farm</Button>
              </Link>
            </div>

            {/* Min order */}
            {data.minimumOrder && (
              <p className="text-xs text-[var(--c-text-3)] mb-4 bg-[var(--c-input)] rounded-lg px-3 py-2 border border-[var(--c-border)]">
                Minimum order: <span className="font-semibold text-[var(--c-text)]">{data.minimumOrder} {data.stockUnit}</span>
              </p>
            )}

            {/* Actions — sticky on mobile */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--c-bg)]/95 backdrop-blur border-t border-[var(--c-border)] flex gap-3 md:relative md:bottom-auto md:left-auto md:right-auto md:p-0 md:bg-transparent md:backdrop-blur-none md:border-none z-30">
              <Button
                size="lg"
                className="flex-1"
                onClick={handleBuyNow}
                disabled={data.status === 'OUT_OF_STOCK'}
              >
                <ShoppingCart className="h-5 w-5" />
                {data.status === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Buy Now'}
              </Button>
              <Button size="lg" variant="secondary" onClick={handleSave} className={saved ? 'text-red-500' : ''}>
                <Heart className={`h-5 w-5 ${saved ? 'fill-red-500 text-red-500' : ''}`} />
              </Button>
              <Button size="lg" variant="secondary" onClick={handleShare}>
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Buy Now Modal */}
      <AnimatePresence>
        {showBuyModal && data && (
          <OrderModal
            product={data}
            seller={seller}
            onClose={() => setShowBuyModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
