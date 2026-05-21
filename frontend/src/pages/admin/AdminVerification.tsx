import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShieldCheck, ShieldX } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

export default function AdminVerification() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['verification-pending'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<User[]>>('/users?isVerified=false&role=FARMER&limit=50')
      return res.data.data
    },
  })

  const verifyMutation = useMutation({
    mutationFn: ({ userId, verifiedType }: { userId: string; verifiedType: string }) =>
      api.put(`/admin/users/${userId}/verify`, { verifiedType }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['verification-pending'] }),
  })

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-6">Farmer Verification</h1>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <div className="text-center py-20">
          <ShieldCheck className="h-12 w-12 text-brand-green mx-auto mb-4" />
          <p className="text-white/40">All farmers verified</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((u, i) => (
            <motion.div key={u._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 bg-brand-800 rounded-2xl border border-white/[0.06] p-4">
              <Avatar src={u.avatar} name={u.name} size="md" />
              <div className="flex-1">
                <p className="text-white font-medium">{u.name}</p>
                <p className="text-white/40 text-sm">@{u.username} · {u.location}</p>
                <p className="text-white/20 text-xs">{timeAgo(u.createdAt)}</p>
              </div>
              <Badge variant="outline" className="text-xs">{u.role}</Badge>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => verifyMutation.mutate({ userId: u._id, verifiedType: 'FARM_VERIFIED' })}>
                  <ShieldCheck className="h-3.5 w-3.5" /> Verify Farm
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => verifyMutation.mutate({ userId: u._id, verifiedType: 'ID_VERIFIED' })}>
                  ID Only
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
