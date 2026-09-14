import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Search, Download, ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface Party { _id: string; name: string; email: string; username: string }

interface TxRow {
  _id: string
  orderNumber?: string
  buyerId?: Party | null
  sellerId?: Party | null
  total: number
  platformFee: number
  currency: string
  status: string
  createdAt: string
}

interface TxPage {
  rows: TxRow[]
  page: number
  limit: number
  total: number
  pages: number
  totals: { gross: number; fees: number; currency: string }
}

const STATUSES = [
  'ALL', 'PENDING', 'PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED',
  'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED',
]

const TONE: Record<string, string> = {
  COMPLETED: 'bg-brand-green/10 text-brand-green',
  DELIVERED: 'bg-brand-green/10 text-brand-green',
  PAYMENT_CONFIRMED: 'bg-blue-500/10 text-blue-500',
  PROCESSING: 'bg-blue-500/10 text-blue-500',
  SHIPPED: 'bg-purple-500/10 text-purple-500',
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  DISPUTED: 'bg-red-500/10 text-red-500',
  CANCELLED: 'bg-[var(--c-raised)] text-[var(--c-text-4)]',
  REFUNDED: 'bg-[var(--c-raised)] text-[var(--c-text-4)]',
}

export default function AdminTransactions() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [submittedQ, setSubmittedQ] = useState('')

  const params = new URLSearchParams({ page: String(page), limit: '25', status })
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (submittedQ) params.set('q', submittedQ)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-transactions', params.toString()],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TxPage>>(`/admin/transactions?${params}`)
      return res.data.data
    },
    // Keeps the table on screen while a new page loads instead of collapsing
    // back to skeletons on every click.
    placeholderData: keepPreviousData,
  })

  const applyFilter = (fn: () => void) => { fn(); setPage(1) }

  /** Export what is currently filtered, not just the visible page. */
  const exportCsv = async () => {
    const all = new URLSearchParams(params)
    all.set('limit', '100')
    const pages = data?.pages ?? 1
    const rows: TxRow[] = []
    for (let p = 1; p <= Math.min(pages, 20); p++) {
      all.set('page', String(p))
      const res = await api.get<ApiResponse<TxPage>>(`/admin/transactions?${all}`)
      rows.push(...(res.data.data?.rows ?? []))
    }
    const header = ['Order', 'Date', 'Buyer', 'Seller', 'Status', 'Total', 'Platform fee', 'Currency']
    const csv = [
      header.join(','),
      ...rows.map(r => [
        r.orderNumber ?? r._id,
        new Date(r.createdAt).toISOString(),
        r.buyerId?.email ?? '',
        r.sellerId?.email ?? '',
        r.status,
        r.total,
        r.platformFee,
        r.currency,
        // Quote every field: names and emails can contain commas.
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `emazao-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--c-text)]">Transactions</h1>
          <p className="text-[var(--c-text-3)] text-sm mt-0.5">Every order on the platform, with the money attached.</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!data?.total}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--c-raised)] text-[var(--c-text-2)] text-sm font-medium hover:text-[var(--c-text)] disabled:opacity-40 transition-colors"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Totals reflect the active filter, not the page on screen. */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4">
          <p className="text-[var(--c-text-3)] text-xs uppercase tracking-wider mb-1">Matching orders</p>
          <p className="text-2xl font-bold text-[var(--c-text)] tabular-nums">{formatNumber(data?.total ?? 0)}</p>
        </div>
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4">
          <p className="text-[var(--c-text-3)] text-xs uppercase tracking-wider mb-1">Gross value</p>
          <p className="text-2xl font-bold text-brand-green tabular-nums">{formatCurrency(data?.totals.gross ?? 0)}</p>
        </div>
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4">
          <p className="text-[var(--c-text-3)] text-xs uppercase tracking-wider mb-1">Platform fees</p>
          <p className="text-2xl font-bold text-gold tabular-nums">{formatCurrency(data?.totals.fees ?? 0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[var(--c-text-3)] text-xs mb-1.5">Order reference</label>
          <div className="flex items-center gap-2 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 focus-within:border-brand-green">
            <Search className="h-4 w-4 text-[var(--c-text-4)] shrink-0" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilter(() => setSubmittedQ(q))}
              placeholder="EM-001…"
              className="flex-1 bg-transparent py-2 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-[var(--c-text-3)] text-xs mb-1.5">Status</label>
          <select
            value={status}
            onChange={e => applyFilter(() => setStatus(e.target.value))}
            className="bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green"
          >
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[var(--c-text-3)] text-xs mb-1.5">From</label>
          <input type="date" value={from} onChange={e => applyFilter(() => setFrom(e.target.value))}
            className="bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green" />
        </div>
        <div>
          <label className="block text-[var(--c-text-3)] text-xs mb-1.5">To</label>
          <input type="date" value={to} onChange={e => applyFilter(() => setTo(e.target.value))}
            className="bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green" />
        </div>
        {(status !== 'ALL' || from || to || submittedQ) && (
          <button
            onClick={() => applyFilter(() => { setStatus('ALL'); setFrom(''); setTo(''); setQ(''); setSubmittedQ('') })}
            className="text-[var(--c-text-3)] text-sm hover:text-[var(--c-text)] py-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Ledger */}
      <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : !data?.rows.length ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-3">
              <Receipt className="h-6 w-6 text-[var(--c-text-4)]" />
            </div>
            <p className="text-[var(--c-text)] font-semibold">No transactions match</p>
            <p className="text-[var(--c-text-3)] text-sm mt-1">Try widening the date range or clearing the status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-[var(--c-text-3)] text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold px-4 py-3">Order</th>
                  <th className="text-left font-semibold px-4 py-3">Buyer</th>
                  <th className="text-left font-semibold px-4 py-3">Seller</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-right font-semibold px-4 py-3">Fee</th>
                  <th className="text-right font-semibold px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border)]">
                {data.rows.map(r => (
                  <tr key={r._id} className="hover:bg-[var(--c-raised)]/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[var(--c-text)] font-medium">{r.orderNumber ?? r._id.slice(-8)}</p>
                      <p className="text-[var(--c-text-4)] text-xs">{new Date(r.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[var(--c-text-2)] truncate max-w-[160px]">{r.buyerId?.name ?? '—'}</p>
                      <p className="text-[var(--c-text-4)] text-xs truncate max-w-[160px]">{r.buyerId?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[var(--c-text-2)] truncate max-w-[160px]">{r.sellerId?.name ?? '—'}</p>
                      <p className="text-[var(--c-text-4)] text-xs truncate max-w-[160px]">{r.sellerId?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${TONE[r.status] ?? 'bg-[var(--c-raised)] text-[var(--c-text-3)]'}`}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--c-text-3)] tabular-nums">{formatCurrency(r.platformFee)}</td>
                    <td className="px-4 py-3 text-right text-[var(--c-text)] font-semibold tabular-nums">{formatCurrency(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[var(--c-text-3)] text-sm">
            Page {data!.page} of {data!.pages}
            {isFetching && <span className="text-[var(--c-text-4)]"> · updating…</span>}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="w-9 h-9 rounded-xl bg-[var(--c-raised)] flex items-center justify-center text-[var(--c-text-2)] disabled:opacity-30 hover:text-[var(--c-text)] transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(data!.pages, p + 1))} disabled={page >= (data?.pages ?? 1)}
              className="w-9 h-9 rounded-xl bg-[var(--c-raised)] flex items-center justify-center text-[var(--c-text-2)] disabled:opacity-30 hover:text-[var(--c-text)] transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
