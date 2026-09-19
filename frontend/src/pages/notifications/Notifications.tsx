import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, ShoppingBag, MessageSquare, TrendingUp, CheckCheck, Heart, UserPlus, Truck, PhoneMissed, MessageCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { shortAgo } from '@/components/stories/StoryViewer'
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
  if (type.includes('ORDER') || type === 'NEW_ORDER') return <ShoppingBag className="h-5 w-5 text-blue-500" />
  if (type.includes('BID') || type === 'NEW_BID')     return <TrendingUp className="h-5 w-5 text-gold" />
  if (type === 'MESSAGE')                              return <MessageSquare className="h-5 w-5 text-purple-500" />
  if (type === 'COMMENT')                              return <MessageCircle className="h-5 w-5 text-sky-500" />
  if (type === 'LIKE')                                 return <Heart className="h-5 w-5 text-red-500" />
  if (type === 'FOLLOW')                               return <UserPlus className="h-5 w-5 text-brand-green" />
  if (type === 'DELIVERY')                             return <Truck className="h-5 w-5 text-brand-emerald" />
  if (type === 'PAYMENT' || type === 'ESCROW_RELEASED') return <TrendingUp className="h-5 w-5 text-gold" />
  if (type === 'MISSED_CALL')                          return <PhoneMissed className="h-5 w-5 text-red-500" />
  return <Bell className="h-5 w-5 text-brand-green" />
}

const notifBg = (type: string) => {
  if (type.includes('ORDER') || type === 'NEW_ORDER')   return 'bg-blue-500/10'
  if (type.includes('BID') || type === 'NEW_BID')       return 'bg-gold/10'
  if (type === 'PAYMENT' || type === 'ESCROW_RELEASED') return 'bg-gold/10'
  if (type === 'MESSAGE')                                return 'bg-purple-500/10'
  if (type === 'COMMENT')                                return 'bg-sky-500/10'
  if (type === 'LIKE')                                   return 'bg-red-500/10'
  if (type === 'DELIVERY')                               return 'bg-brand-emerald/10'
  if (type === 'MISSED_CALL')                            return 'bg-red-500/10'
  return 'bg-brand-green/10'
}

export default function Notifications() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Notification[]> & { unreadCount: number }>('/notifications')
      return res.data
    },
  })

  // The bell reads its number from a separate query. Refreshing only the list
  // left the badge showing the old count until a full reload.
  const refreshCounts = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
  }

  const markAllMutation = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: refreshCounts,
  })

  const markOneMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: refreshCounts,
  })

  // Opening this page clears the badge, as Instagram's activity tab does. The
  // list keeps the unread highlighting it loaded with, so what is new is still
  // visible for this visit; only the counter resets.
  const clearedRef = useRef(false)
  useEffect(() => {
    if (clearedRef.current || !data || (data.unreadCount ?? 0) === 0) return
    clearedRef.current = true
    api.put('/notifications/read-all')
      .then(() => queryClient.setQueryData(['notifications-count'], (old: any) => old ? { ...old, unreadCount: 0 } : { unreadCount: 0 }))
      .catch(() => {})
  }, [data, queryClient])

  const notifications = data?.data ?? []

  // Instagram's grouping: what arrived since your last visit, then by age.
  const groups = useMemo(() => {
    const now = Date.now()
    const day = 86_400_000
    const buckets: { key: string; label: string; items: Notification[] }[] = [
      { key: 'new', label: 'New', items: [] },
      { key: 'today', label: 'Today', items: [] },
      { key: 'week', label: 'This week', items: [] },
      { key: 'earlier', label: 'Earlier', items: [] },
    ]
    for (const n of notifications) {
      const age = now - +new Date(n.createdAt)
      const b = !n.isRead ? 0 : age < day ? 1 : age < 7 * day ? 2 : 3
      buckets[b].items.push(n)
    }
    return buckets.filter(b => b.items.length)
  }, [notifications])

  return (
    <div className="max-w-[620px] mx-auto pb-10">
      <div className="flex items-center justify-between px-4 pt-4 lg:pt-8 pb-2">
        <h1 className="text-[24px] font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-display)' }}>Notifications</h1>
        {notifications.some(n => !n.isRead) && (
          <button onClick={() => markAllMutation.mutate()} className="text-[13.5px] font-semibold text-brand-green flex items-center gap-1">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="px-4 space-y-4 pt-4">{[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/4 rounded" /><Skeleton className="h-3 w-1/3 rounded" /></div></div>
        ))}</div>
      ) : !notifications.length ? (
        <div className="text-center py-24 px-6">
          <div className="w-20 h-20 rounded-full border-2 border-[var(--c-text)] flex items-center justify-center mx-auto mb-4">
            <Heart className="h-9 w-9 text-[var(--c-text)]" strokeWidth={1.6} />
          </div>
          <p className="text-[var(--c-text)] font-semibold text-lg mb-1">Activity on your posts</p>
          <p className="text-[var(--c-text-3)] text-sm max-w-xs mx-auto">When someone likes, comments, follows, orders or sends you a message, you will see it here.</p>
        </div>
      ) : groups.map(g => (
        <section key={g.key} className="pt-3 pb-1 border-b border-[var(--c-border-sub)] last:border-b-0">
          <h2 className="px-4 pb-1.5 text-[15px] font-bold text-[var(--c-text)]">{g.label}</h2>
          {g.items.map(n => (
            <button
              key={n._id}
              onClick={() => {
                if (!n.isRead) markOneMutation.mutate(n._id)
                if (n.link) navigate(n.link)
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--c-raised)]/60 ${!n.isRead ? 'bg-brand-green/[0.06]' : ''}`}
            >
              <span className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${notifBg(n.type)}`}>
                {notifIcon(n.type)}
              </span>
              <span className="flex-1 min-w-0 text-[14px] leading-snug text-[var(--c-text)] line-clamp-2">
                <span className="font-semibold">{n.title}</span>{n.body && <> <span className="text-[var(--c-text-2)]">{n.body}</span></>}
                <span className="text-[var(--c-text-3)] whitespace-nowrap"> · {shortAgo(n.createdAt)}</span>
              </span>
              {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-green flex-shrink-0" aria-label="New" />}
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}
