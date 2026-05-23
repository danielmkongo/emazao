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
  status: string
  createdAt: string
}

export default function AdminDisputes() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Dispute[]>>('/admin/disputes')
      return res.data.data
    },
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      api.put(`/admin/disputes/${id}/resolve`, { resolution }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-disputes'] }),
  })

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[var(--c-text)] mb-6">Disputes</h1>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <div className="text-center py-20">
          <AlertOctagon className="h-12 w-12 text-[var(--c-text-4)] mx-auto mb-4" />
          <p className="text-[var(--c-text-3)]">No active disputes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((d, i) => (
            <motion.div key={d._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-[var(--c-text-3)]">{d.orderId?.orderNumber}</span>
                    <Badge variant="urgent" className="text-xs">{d.status}</Badge>
                  </div>
                  <p className="text-[var(--c-text)] font-medium">{d.reason}</p>
                  <p className="text-[var(--c-text-3)] text-sm">By @{d.raisedById?.username} · {timeAgo(d.createdAt)}</p>
                </div>
                <p className="text-[var(--c-text)] font-semibold">{formatCurrency(d.orderId?.total)}</p>
              </div>
              {d.status === 'OPEN' && (
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
        </div>
      )}
    </div>
  )
}
