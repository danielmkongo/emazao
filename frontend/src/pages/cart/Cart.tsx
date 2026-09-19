import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ShoppingCart, Minus, Plus, Trash2, AlertTriangle, ShieldCheck, Store, CheckCircle2, Loader2, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { PaymentForm } from '@/components/payment/PaymentForm'
import { useCart, type CartLine } from '@/hooks/useCart'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface CheckoutResult {
  checkoutId: string
  total: number
  orders: { _id: string; orderNumber: string; total: number }[]
}

interface CheckoutStatus {
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  orderIds: { _id: string; orderNumber: string; status: string; total: number; sellerId?: { name: string } }[]
}

function Stepper({ line, onChange, busy }: { line: CartLine; onChange: (q: number) => void; busy: boolean }) {
  const step = Math.max(1, Math.round((line.minimumOrder || 1) / 10)) // coarse steps for bulk goods
  const [draft, setDraft] = useState(String(line.quantity))
  useEffect(() => { setDraft(String(line.quantity)) }, [line.quantity])

  const commit = () => {
    const n = Number(draft)
    if (Number.isFinite(n) && n > 0 && n !== line.quantity) onChange(n)
    else setDraft(String(line.quantity))
  }

  return (
    <div className="flex items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-input)] overflow-hidden">
      <button
        type="button" disabled={busy} aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(0, line.quantity - step))}
        className="w-8 h-8 flex items-center justify-center text-[var(--c-text-2)] hover:bg-[var(--c-raised)] disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        aria-label="Quantity" inputMode="decimal" value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="w-14 h-8 text-center text-sm bg-transparent text-[var(--c-text)] tabular-nums focus:outline-none"
      />
      <button
        type="button" disabled={busy} aria-label="Increase quantity"
        onClick={() => onChange(line.quantity + step)}
        className="w-8 h-8 flex items-center justify-center text-[var(--c-text-2)] hover:bg-[var(--c-raised)] disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function Cart() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { cart, isLoading, update, remove } = useCart()
  const queryClient = useQueryClient()

  const [stage, setStage] = useState<'cart' | 'address' | 'pay' | 'done'>('cart')
  const [address, setAddress] = useState({ street: '', city: '', region: user?.region ?? '', country: user?.country ?? '' })
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<CheckoutResult | null>(null)

  const busy = update.isPending || remove.isPending
  const blocked = cart.groups.some(g => g.items.some(i => i.belowMinimum))

  const checkout = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<CheckoutResult>>('/cart/checkout', { deliveryAddress: address, notes })
      return res.data.data
    },
    onSuccess: data => {
      setResult(data)
      setStage('pay')
      // The server emptied the cart when it became orders; without this the
      // badge kept showing the old count on every page until a refresh.
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  // Confirmation arrives by webhook after the buyer approves on their handset,
  // so poll the checkout until every order has flipped.
  const { data: status } = useQuery({
    queryKey: ['checkout', result?.checkoutId],
    queryFn: async () => (await api.get<ApiResponse<CheckoutStatus>>(`/cart/checkout/${result!.checkoutId}`)).data.data,
    enabled: stage === 'done' && Boolean(result?.checkoutId),
    refetchInterval: q => (q.state.data?.status === 'PAID' ? false : 3000),
  })

  if (isLoading) {
    return <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
  }

  /* ── Done ───────────────────────────────────────────────────────────── */
  if (stage === 'done' && result) {
    const paid = status?.status === 'PAID'
    // Live rows once the status poll answers; the checkout response until then.
    const rows: { _id: string; orderNumber: string; total: number; seller?: string; status?: string }[] =
      status?.orderIds.map(o => ({ _id: o._id, orderNumber: o.orderNumber, total: o.total, seller: o.sellerId?.name, status: o.status }))
      ?? result.orders.map(o => ({ _id: o._id, orderNumber: o.orderNumber, total: o.total }))
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-brand-green/10 border-2 border-brand-green flex items-center justify-center mx-auto mb-5">
          {paid ? <CheckCircle2 className="h-8 w-8 text-brand-green" /> : <Loader2 className="h-8 w-8 text-brand-green animate-spin" />}
        </div>
        <h1 className="text-xl font-bold text-[var(--c-text)]">{paid ? 'Payment confirmed' : 'Waiting for your payment'}</h1>
        <p className="text-[var(--c-text-3)] text-sm mt-2">
          {paid
            ? `One payment of ${formatCurrency(result.total)} covered ${result.orders.length} orders. Each seller has been told to prepare their part.`
            : 'Approve the prompt on your phone. This page updates on its own once the payment clears.'}
        </p>
        <div className="mt-6 bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl divide-y divide-[var(--c-border)] text-left">
          {rows.map(o => (
            <Link key={o._id} to={`/orders/${o._id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--c-raised)]/50">
              <div className="min-w-0">
                <p className="font-mono text-sm text-[var(--c-text)]">{o.orderNumber}</p>
                {o.seller && <p className="text-[var(--c-text-3)] text-xs">{o.seller}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-[var(--c-text)] tabular-nums">{formatCurrency(o.total)}</p>
                {o.status && <p className={`text-[11px] ${o.status === 'PENDING' ? 'text-amber-500' : 'text-brand-green'}`}>{o.status.replace(/_/g, ' ')}</p>}
              </div>
            </Link>
          ))}
        </div>
        <Button className="w-full mt-6" onClick={() => navigate('/orders')}>View my orders</Button>
      </div>
    )
  }

  /* ── Pay ────────────────────────────────────────────────────────────── */
  if (stage === 'pay' && result) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-[var(--c-text)] mb-1">Pay for your order</h1>
        <p className="text-[var(--c-text-3)] text-sm mb-5">
          One payment for {result.orders.length} seller{result.orders.length !== 1 ? 's' : ''}.
        </p>
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4 mb-4">
          {result.orders.map(o => (
            <div key={o._id} className="flex justify-between text-sm py-1">
              <span className="font-mono text-[var(--c-text-2)]">{o.orderNumber}</span>
              <span className="tabular-nums text-[var(--c-text)]">{formatCurrency(o.total)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-[var(--c-text)] pt-3 mt-2 border-t border-[var(--c-border)]">
            <span>Total</span><span className="tabular-nums">{formatCurrency(result.total)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--c-text-3)] bg-brand-green/5 border border-brand-green/15 rounded-xl px-3 py-2.5 mb-4">
          <ShieldCheck className="h-4 w-4 text-brand-green shrink-0" />
          Each seller's share is held in escrow separately until you confirm that seller's delivery.
        </div>
        <PaymentForm checkoutId={result.checkoutId} onSuccess={() => setStage('done')} />
        <p className="text-[var(--c-text-4)] text-xs text-center mt-4">
          Your orders are saved. If you leave now you can pay later from <Link to="/orders" className="text-brand-green">My orders</Link>.
        </p>
      </div>
    )
  }

  /* ── Empty ──────────────────────────────────────────────────────────── */
  if (!cart.groups.length) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-4">
          <ShoppingCart className="h-7 w-7 text-[var(--c-text-4)]" />
        </div>
        <h1 className="text-xl font-bold text-[var(--c-text)]">Your cart is empty</h1>
        <p className="text-[var(--c-text-3)] text-sm mt-1 mb-6">Add produce from as many farmers as you like, then pay for everything at once.</p>
        {cart.unavailable.length > 0 && (
          <p className="text-amber-600 dark:text-amber-400 text-sm mb-4">
            {cart.unavailable.length} item(s) you added are no longer available.
          </p>
        )}
        <Button onClick={() => navigate('/marketplace')}>Browse the marketplace</Button>
      </div>
    )
  }

  /* ── Cart + address ─────────────────────────────────────────────────── */
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-5">
        {stage === 'address' && (
          <button onClick={() => setStage('cart')} aria-label="Back to cart" className="text-[var(--c-text-3)] hover:text-[var(--c-text)]">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-2xl font-bold text-[var(--c-text)]">{stage === 'address' ? 'Delivery details' : 'Cart'}</h1>
        {stage === 'cart' && (
          <span className="text-[var(--c-text-3)] text-sm">
            {cart.itemCount} item{cart.itemCount !== 1 ? 's' : ''} from {cart.groups.length} seller{cart.groups.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          {cart.unavailable.length > 0 && stage === 'cart' && (
            <div className="flex items-start gap-3 bg-amber-500/[0.07] border border-amber-500/30 rounded-2xl p-4">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-[var(--c-text)] font-medium">Some items are no longer available</p>
                <ul className="text-[var(--c-text-3)] mt-1 space-y-0.5">
                  {cart.unavailable.map(u => (
                    <li key={u.productId} className="flex items-center gap-2">
                      <span>{u.title} — {u.reason}</span>
                      <button onClick={() => remove.mutate(u.productId)} className="text-brand-green text-xs font-medium hover:underline">Remove</button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {stage === 'cart' ? cart.groups.map(g => (
            <section key={g.seller._id} className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
              <Link to={`/farm/${g.seller.username}`} className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--c-border)] hover:bg-[var(--c-raised)]/40">
                <Avatar src={g.seller.avatar} name={g.seller.name} size="sm" verified={g.seller.isVerified} />
                <span className="font-semibold text-sm text-[var(--c-text)] flex-1 truncate">{g.seller.name}</span>
                <Store className="h-4 w-4 text-[var(--c-text-4)]" />
              </Link>

              <div className="divide-y divide-[var(--c-border)]">
                {g.items.map(line => (
                  <div key={line.productId} className="flex gap-3 p-4">
                    <Link to={`/marketplace/product/${line.slug ?? line.productId}`} className="shrink-0">
                      <ImageWithFallback src={line.image} alt={line.title} className="w-20 h-20 rounded-xl object-cover" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[var(--c-text)] text-sm font-medium line-clamp-2">{line.title}</p>
                        <button onClick={() => remove.mutate(line.productId)} disabled={busy} aria-label={`Remove ${line.title}`}
                          className="text-[var(--c-text-4)] hover:text-red-500 shrink-0 disabled:opacity-40">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-[var(--c-text-3)] text-xs mt-0.5 tabular-nums">{formatCurrency(line.unitPrice)} / {line.unit}</p>
                      <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Stepper line={line} busy={busy} onChange={q => q === 0 ? remove.mutate(line.productId) : update.mutate({ productId: line.productId, quantity: q })} />
                          <span className="text-[var(--c-text-4)] text-xs">{line.unit}</span>
                        </div>
                        <p className="font-semibold text-[var(--c-text)] text-sm tabular-nums">{formatCurrency(line.lineTotal)}</p>
                      </div>
                      {line.belowMinimum && (
                        <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">
                          Minimum order is {line.minimumOrder} {line.unit}.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between px-4 py-2.5 bg-[var(--c-raised)]/40 text-xs text-[var(--c-text-3)]">
                <span>This seller's order</span>
                <span className="tabular-nums text-[var(--c-text-2)] font-medium">{formatCurrency(g.total)}</span>
              </div>
            </section>
          )) : (
            <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-5 space-y-3">
              {(['street', 'city', 'region', 'country'] as const).map(field => (
                <div key={field}>
                  <label htmlFor={`addr-${field}`} className="block text-sm font-medium text-[var(--c-text-2)] mb-1.5 capitalize">
                    {field === 'street' ? 'Street address' : field}{field === 'region' && <span className="text-[var(--c-text-4)] font-normal"> (optional)</span>}
                  </label>
                  <input
                    id={`addr-${field}`}
                    value={address[field]}
                    onChange={e => setAddress(a => ({ ...a, [field]: e.target.value }))}
                    className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green"
                  />
                </div>
              ))}
              <div>
                <label htmlFor="addr-notes" className="block text-sm font-medium text-[var(--c-text-2)] mb-1.5">
                  Notes for the sellers <span className="text-[var(--c-text-4)] font-normal">(optional)</span>
                </label>
                <textarea id="addr-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green" />
              </div>
              <p className="text-[var(--c-text-4)] text-xs">
                Every seller delivers to this address. Each ships separately, so items may arrive on different days.
              </p>
            </div>
          )}
        </div>

        {/* Summary */}
        <aside className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-5 lg:sticky lg:top-6">
          <h2 className="font-semibold text-[var(--c-text)] mb-3">Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[var(--c-text-2)]"><span>Items</span><span className="tabular-nums">{formatCurrency(cart.subtotal)}</span></div>
            <div className="flex justify-between text-[var(--c-text-2)]"><span>Service fee</span><span className="tabular-nums">{formatCurrency(cart.platformFee)}</span></div>
            <div className="flex justify-between text-[var(--c-text-3)] text-xs"><span>Sellers</span><span>{cart.groups.length} separate order{cart.groups.length !== 1 ? 's' : ''}</span></div>
          </div>
          <div className="flex justify-between font-bold text-[var(--c-text)] text-lg pt-3 mt-3 border-t border-[var(--c-border)]">
            <span>Total</span><span className="tabular-nums">{formatCurrency(cart.total)}</span>
          </div>

          {checkout.isError && (
            <p className="text-red-500 text-sm mt-3">{(checkout.error as any)?.response?.data?.message ?? 'Could not place the order.'}</p>
          )}

          {stage === 'cart' ? (
            <Button className="w-full mt-4" size="lg" disabled={blocked || busy} onClick={() => setStage('address')}>
              Checkout
            </Button>
          ) : (
            <Button
              className="w-full mt-4" size="lg"
              disabled={!address.street.trim() || !address.city.trim() || !address.country.trim() || checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? 'Placing orders…' : `Continue to payment`}
            </Button>
          )}
          {blocked && stage === 'cart' && (
            <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">Raise the items below their minimum order to continue.</p>
          )}
          <p className="flex items-start gap-1.5 text-[var(--c-text-4)] text-xs mt-3">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-brand-green" />
            One payment, held in escrow per seller until you confirm each delivery.
          </p>
        </aside>
      </div>
    </div>
  )
}
