import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { FileText, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, Bid, Requirement } from '@/types'

export default function DashboardBids() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-bids'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Bid[]>>('/requirements/my/bids')
      return res.data.data
    },
  })

  const statusColor: Record<string, 'default' | 'gold' | 'organic' | 'urgent' | 'outline'> = {
    PENDING: 'outline', SHORTLISTED: 'gold', ACCEPTED: 'default', REJECTED: 'urgent', WITHDRAWN: 'outline',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">My Bids</h1>
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <div className="text-center py-20"><FileText className="h-12 w-12 text-white/20 mx-auto mb-4" /><p className="text-white/40">You haven't submitted any bids yet</p></div>
      ) : (
        <div className="space-y-3">
          {data.map((bid, i) => {
            const req = bid.requirementId as unknown as Requirement
            return (
              <motion.div key={bid._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-brand-800 rounded-2xl border border-white/[0.06] p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white">{req?.title || 'Requirement'}</h3>
                  <Badge variant={statusColor[bid.status] ?? 'outline'}>{bid.status}</Badge>
                </div>
                <div className="flex items-center gap-6 text-sm text-white/40">
                  <span className="font-semibold text-white">{formatCurrency(bid.totalPrice)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeAgo(bid.createdAt)}</span>
                  <span>{bid.deliveryTimeline}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
