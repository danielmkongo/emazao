import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AlertOctagon, CheckCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface Dispute {
  _id: string
  orderId: { _id: string; orderNumber: string; total: number }
  raisedById: { name: string; username: string }
  reason: string
  description?: string
  status: string
  createdAt: string
  escrow?: { _id: string; status: string; refundStatus?: 'PENDING' | 'SENT' | 'FAILED'; refundError?: string } | null
}

const REASON_LABEL: Record<string, string> = {
  NOT_RECEIVED: 'Not received', NOT_AS_DESCRIBED: 'Not as described', DAMAGED: 'Damaged',
  WRONG_QUANTITY: 'Wrong quantity', OTHER: 'Other',
}

const STATUS_TABS = ['OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'ESCALATED']
const LIMIT = 20

export default function AdminDisputes() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<string>('OPEN')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-disputes', status, page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Dispute[]> & { pagination: { total: number } }>(
        `/admin/disputes?status=${status}&page=${page}&limit=${LIMIT}`
      )
      return { disputes: res.data.data, total: res.data.pagination.total }
    },
  })

  const retryMutation = useMutation({
    mutationFn: (escrowId: string) => api.post(`/admin/escrows/${escrowId}/retry-refund`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-disputes'] }),
    onError: (e: any) => window.alert(e?.response?.data?.message ?? 'Refund could not be sent'),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) => {
      const msg = resolution === 'REFUND_BUYER'
        ? 'Refund the buyer? The full amount is sent back to the mobile money number that paid.'
        : 'Release the payment to the seller?'
      if (!window.confirm(msg)) return Promise.reject(new Error('cancelled'))
      return api.put(`/admin/disputes/${id}/resolve`, { resolution })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-disputes'] }),
  })

  const disputes = data?.disputes
  const hasMore = data ? page * LIMIT < data.total : false

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[var(--c-text)] mb-4">Disputes</h1>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              status === s ? 'bg-brand-green text-white' : 'bg-[var(--c-input)] text-[var(--c-text-2)]'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : !disputes?.length ? (
        <div className="text-center py-20">
          <AlertOctagon className="h-12 w-12 text-[var(--c-text-4)] mx-auto mb-4" />
          <p className="text-[var(--c-text-3)]">No disputes in this status</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d, i) => (
            <motion.div key={d._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-[var(--c-text-3)]">{d.orderId?.orderNumber}</span>
                    <Badge variant="urgent" className="text-xs">{d.status}</Badge>
                  </div>
                  <p className="text-[var(--c-text)] font-medium">{REASON_LABEL[d.reason] ?? d.reason}</p>
                  {d.description && <p className="text-[var(--c-text-2)] text-sm mt-1 max-w-xl whitespace-pre-line">{d.description}</p>}
                  <p className="text-[var(--c-text-3)] text-sm">By @{d.raisedById?.username} · {timeAgo(d.createdAt)}</p>
                </div>
                <p className="text-[var(--c-text)] font-semibold">{formatCurrency(d.orderId?.total)}</p>
              </div>
              {d.escrow?.status === 'REFUNDED' && (
                <div className={`mb-3 text-sm rounded-xl px-3 py-2 ${d.escrow.refundStatus === 'FAILED' ? 'bg-red-500/10 text-red-500' : 'bg-brand-green/10 text-brand-green'}`}>
                  {d.escrow.refundStatus === 'SENT' ? 'Refund sent to the buyer\'s mobile money.'
                    : d.escrow.refundStatus === 'FAILED' ? `Refund payout failed: ${d.escrow.refundError ?? 'unknown error'}`
                    : 'Refund payout in progress.'}
                  {d.escrow.refundStatus === 'FAILED' && (
                    <Button size="sm" variant="outline" className="ml-3" onClick={() => retryMutation.mutate(d.escrow!._id)} disabled={retryMutation.isPending}>
                      Retry refund
                    </Button>
                  )}
                </div>
              )}
              {['OPEN', 'UNDER_REVIEW', 'ESCALATED'].includes(d.status) && (
                <div className="flex gap-3">
                  <Button size="sm" onClick={() => resolveMutation.mutate({ id: d._id, resolution: 'RELEASE_TO_SELLER' })}>
                    <CheckCircle className="h-3.5 w-3.5" /> Release to Seller
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolveMutation.mutate({ id: d._id, resolution: 'REFUND_BUYER' })}>
                    <XCircle className="h-3.5 w-3.5" /> Refund Buyer
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
          {(page > 1 || hasMore) && (
            <div className="flex justify-between gap-3 pt-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
