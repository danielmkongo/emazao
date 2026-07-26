import api from '@/lib/api'
import { useUnreadStore } from '@/store/unreadStore'

// Re-fetches the true unread-message count from the server and syncs it into
// the shared store. Called on load and after marking a conversation read —
// safer than local increment/decrement math drifting out of sync over time.
export async function refreshUnreadMessages(): Promise<void> {
  try {
    const res = await api.get<{ success: boolean; data: { count: number } }>('/messages/unread-count')
    useUnreadStore.getState().setUnreadMessages(res.data.data.count)
  } catch {
    // leave the count as-is on failure
  }
}
