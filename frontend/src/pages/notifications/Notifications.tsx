import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bell, ShoppingBag, MessageSquare, TrendingUp, CheckCheck, Heart, UserPlus, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
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
  if (type === 'ORDER')    return <ShoppingBag className="h-4 w-4 text-blue-500" />
  if (type === 'MESSAGE')  return <MessageSquare className="h-4 w-4 text-purple-500" />
  if (type === 'BID')      return <TrendingUp className="h-4 w-4 text-gold" />
  if (type === 'LIKE')     return <Heart className="h-4 w-4 text-red-500" />
  if (type === 'FOLLOW')   return <UserPlus className="h-4 w-4 text-brand-green" />
  if (type === 'DELIVERY') return <Truck className="h-4 w-4 text-brand-emerald" />
  if (type === 'PAYMENT')  return <TrendingUp className="h-4 w-4 text-gold" />
  return <Bell className="h-4 w-4 text-brand-green" />
}

const notifBg = (type: string) => {
  if (type === 'ORDER')    return 'bg-blue-500/10'
  if (type === 'MESSAGE')  return 'bg-purple-500/10'
  if (type === 'BID' || type === 'PAYMENT') return 'bg-gold/10'
  if (type === 'LIKE')     return 'bg-red-500/10'
  if (type === 'FOLLOW')   return 'bg-brand-green/10'
  if (type === 'DELIVERY') return 'bg-brand-emerald/10'
  return 'bg-brand-green/10'
}

export default function Notifications() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', user?._id],
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
          <h1 className="text-2xl font-bold text-[var(--c-text)]">Notifications</h1>
          {unread > 0 && <p className="text-brand-green text-sm mt-0.5">{unread} unread</p>}
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
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-4">
            <Bell className="h-7 w-7 text-[var(--c-text-4)]" />
          </div>
          <p className="text-[var(--c-text)] font-semibold mb-1">No notifications yet</p>
          <p className="text-[var(--c-text-3)] text-sm">Activity will appear here as you use eMazao.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n, i) => (
            <motion.div
              key={n._id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => !n.isRead && markOneMutation.mutate(n._id)}
              className={`flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all ${
                n.isRead
                  ? 'opacity-70 hover:opacity-100 hover:bg-[var(--c-raised)]'
                  : 'bg-[var(--c-card)] border border-[var(--c-border)] hover:border-brand-green/20 shadow-sm'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${notifBg(n.type)}`}>
                {notifIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${n.isRead ? 'text-[var(--c-text-2)]' : 'text-[var(--c-text)]'}`}>{n.title}</p>
                <p className="text-[var(--c-text-3)] text-xs mt-0.5 leading-relaxed">{n.body}</p>
                <p className="text-[var(--c-text-4)] text-xs mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.isRead && <div className="w-2 h-2 rounded-full bg-brand-green flex-shrink-0 mt-2" />}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
