import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bell, ShoppingBag, MessageSquare, TrendingUp, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface Notification {
  _id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  link?: string
}

const notifIcon = (type: string) => {
  if (type.includes('ORDER')) return <ShoppingBag className="h-4 w-4 text-blue-400" />
  if (type.includes('MESSAGE')) return <MessageSquare className="h-4 w-4 text-purple-400" />
  if (type.includes('BID')) return <TrendingUp className="h-4 w-4 text-gold" />
  return <Bell className="h-4 w-4 text-brand-green" />
}

export default function Notifications() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Notification[]> & { unreadCount: number }>('/notifications')
      return res.data
    },
  })

  const markAllMutation = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markOneMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = data?.data ?? []
  const unread = data?.unreadCount ?? 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unread > 0 && <p className="text-brand-green text-sm">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <Button size="sm" variant="ghost" onClick={() => markAllMutation.mutate()} loading={markAllMutation.isPending}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !notifications.length ? (
        <div className="text-center py-20">
          <Bell className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n, i) => (
            <motion.div key={n._id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => !n.isRead && markOneMutation.mutate(n._id)}
              className={`flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-colors ${
                n.isRead ? 'opacity-60 hover:bg-white/[0.02]' : 'bg-brand-800 hover:bg-brand-700'
              }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${n.isRead ? 'bg-brand-700' : 'bg-brand-700 ring-1 ring-brand-green/30'}`}>
                {notifIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{n.title}</p>
                <p className="text-white/50 text-xs mt-0.5">{n.body}</p>
                <p className="text-white/20 text-xs mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.isRead && <div className="w-2 h-2 rounded-full bg-brand-green flex-shrink-0 mt-1.5" />}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
