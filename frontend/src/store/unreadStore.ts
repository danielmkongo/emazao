import { create } from 'zustand'

interface UnreadState {
  unreadMessages: number
  activeConversationId: string | null
  setUnreadMessages: (n: number) => void
  incrementUnreadMessages: () => void
  setActiveConversationId: (id: string | null) => void
}

// Not persisted — always re-derived from the server (GET /messages/unread-count)
// on load, then kept live via socket events for the rest of the session.
export const useUnreadStore = create<UnreadState>()((set) => ({
  unreadMessages: 0,
  activeConversationId: null,
  setUnreadMessages: (n) => set({ unreadMessages: Math.max(0, n) }),
  incrementUnreadMessages: () => set((s) => ({ unreadMessages: s.unreadMessages + 1 })),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
}))
