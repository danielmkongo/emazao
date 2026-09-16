import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Package, Truck, CheckCircle, MapPin, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface TrackEvent { status: string; note?: string; location?: string; at: string }

interface Shipment {
  orderNumber: string
  trackingNumber?: string
  carrier?: string
  status: string
  dispatchedAt?: string
  estimatedDelivery?: string
  deliveredAt?: string
  buyer?: string
  seller?: string
  events: TrackEvent[]
}

const STATUS_ICON: Record<string, typeof Package> = {
  DISPATCHED: Truck,
  IN_TRANSIT: Truck,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: CheckCircle,
}

export default function TrackOrder() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('n') ?? ''
  const [input, setInput] = useState(initial)
  const [query, setQuery] = useState(initial)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['track', query],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Shipment>>(`/orders/track/${encodeURIComponent(query)}`)
      return res.data.data
    },
    enabled: Boolean(query),
    retry: false,
  })

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    const v = input.trim()
    if (!v) return
    setQuery(v)
    // Keep it in the URL so a tracking link can be shared or bookmarked.
    setParams({ n: v })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--c-text)] mb-1">Track my product</h1>
      <p className="text-[var(--c-text-3)] text-sm mb-6">
        Enter a tracking number or an order number to see where your shipment is.
      </p>

      <form onSubmit={search} className="flex gap-2 mb-6">
        <div className="flex-1 flex items-center gap-2 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 focus-within:border-brand-green transition-colors">
          <Search className="h-4 w-4 text-[var(--c-text-4)] shrink-0" />
          <input
            id="tracking-number"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="EMZ-TRK-XXXXXXXX or EM-TOM2401"
            className="flex-1 bg-transparent py-3 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none font-mono"
          />
        </div>
        <Button type="submit" disabled={!input.trim()}>Track</Button>
      </form>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-3 bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[var(--c-text)] font-semibold">
              {(error as any)?.response?.status === 404 ? 'No shipment found with that number' : 'Could not load this shipment'}
            </p>
            <p className="text-[var(--c-text-3)] text-sm mt-1">
              Check the number and try again. You can only track orders you are part of — if this shipment
              belongs to someone else, ask them to share its status with you.
            </p>
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4 mb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[var(--c-text-3)] text-xs uppercase tracking-wider mb-1">Order</p>
                <p className="font-semibold text-[var(--c-text)]">{data.orderNumber}</p>
                {data.seller && <p className="text-[var(--c-text-3)] text-sm mt-0.5">from {data.seller}</p>}
              </div>
              <div className="text-right">
                <p className="text-[var(--c-text-3)] text-xs uppercase tracking-wider mb-1">Status</p>
                <p className="font-semibold text-brand-green">{data.status.replace(/_/g, ' ')}</p>
                {data.carrier && <p className="text-[var(--c-text-3)] text-sm mt-0.5">{data.carrier}</p>}
              </div>
            </div>

            {(data.dispatchedAt || data.estimatedDelivery || data.deliveredAt) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-[var(--c-border)]">
                {data.dispatchedAt && (
                  <div>
                    <p className="text-[var(--c-text-4)] text-[11px] uppercase tracking-wider">Dispatched</p>
                    <p className="text-[var(--c-text-2)] text-sm">{new Date(data.dispatchedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {data.estimatedDelivery && (
                  <div>
                    <p className="text-[var(--c-text-4)] text-[11px] uppercase tracking-wider">Expected</p>
                    <p className="text-[var(--c-text-2)] text-sm">{new Date(data.estimatedDelivery).toLocaleDateString()}</p>
                  </div>
                )}
                {data.deliveredAt && (
                  <div>
                    <p className="text-[var(--c-text-4)] text-[11px] uppercase tracking-wider">Delivered</p>
                    <p className="text-brand-green text-sm font-medium">{new Date(data.deliveredAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4">
            <h2 className="font-semibold text-[var(--c-text)] mb-4">Journey</h2>
            {data.events.length === 0 ? (
              <p className="text-[var(--c-text-3)] text-sm">
                No movement recorded yet. The seller updates this as the shipment travels.
              </p>
            ) : (
              // Newest first: the current location is what someone opened this page for.
              <ol className="relative border-l border-[var(--c-border)] ml-1.5 space-y-4">
                {[...data.events].reverse().map((e, i) => {
                  const Icon = STATUS_ICON[e.status] ?? MapPin
                  const latest = i === 0
                  return (
                    <li key={i} className="pl-5 relative">
                      <span className={`absolute -left-[9px] top-1 w-[17px] h-[17px] rounded-full flex items-center justify-center ${
                        latest ? 'bg-brand-green text-white' : 'bg-[var(--c-raised)] text-[var(--c-text-4)]'
                      }`}>
                        <Icon className="h-2.5 w-2.5" />
                      </span>
                      <p className={`text-sm font-medium ${latest ? 'text-[var(--c-text)]' : 'text-[var(--c-text-2)]'}`}>
                        {e.status.replace(/_/g, ' ')}
                        {e.location && <span className="text-[var(--c-text-3)] font-normal"> · {e.location}</span>}
                      </p>
                      {e.note && <p className="text-[var(--c-text-3)] text-xs mt-0.5">{e.note}</p>}
                      <p className="text-[var(--c-text-4)] text-[11px] mt-0.5">{new Date(e.at).toLocaleString()}</p>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          <Link to="/orders" className="inline-block mt-4 text-brand-green text-sm font-medium hover:underline">
            View all my orders →
          </Link>
        </>
      )}

      {!query && !isLoading && (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-3">
            <Package className="h-6 w-6 text-[var(--c-text-4)]" />
          </div>
          <p className="text-[var(--c-text-3)] text-sm">
            Your tracking number is on the order page, and in the message sent when the seller dispatched it.
          </p>
        </div>
      )}
    </div>
  )
}
