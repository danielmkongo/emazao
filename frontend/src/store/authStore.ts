import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { queryClient } from '@/lib/queryClient'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  updateUser: (updates: Partial<User>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        // Normalize: old API returned { id } instead of { _id }
        const normalized = { ...user } as any
        if (!normalized._id && normalized.id) { normalized._id = normalized.id; delete normalized.id }
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
        set({ user: normalized as User, accessToken, refreshToken, isAuthenticated: true })
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      clearAuth: () => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        queryClient.clear()
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'emazao-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          const u = state.user as any
          if (!u._id && u.id) { u._id = u.id; delete u.id }
        }
      },
    }
  )
)
