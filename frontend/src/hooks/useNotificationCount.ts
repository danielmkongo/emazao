import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

/**
 * Unread notification count — the one source for every bell badge, so the
 * phone top bar and the desktop sidebar can never disagree.
 */
export function useNotificationCount() {
  const user = useAuthStore(s => s.user)
  const { data } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => (await api.get<{ unreadCount: number }>('/notifications?limit=1')).data,
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  return data?.unreadCount ?? 0
}
