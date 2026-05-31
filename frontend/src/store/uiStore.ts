import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  theme: 'dark' | 'light'
  sidebarOpen: boolean
  cartOpen: boolean
  searchOpen: boolean
  toggleTheme: () => void
  setSidebarOpen: (v: boolean) => void
  setCartOpen: (v: boolean) => void
  setSearchOpen: (v: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarOpen: false,
      cartOpen: false,
      searchOpen: false,
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      setCartOpen: (v) => set({ cartOpen: v }),
      setSearchOpen: (v) => set({ searchOpen: v }),
    }),
    // key bumped to -v2 so the new light default takes effect once for everyone
    // (old persisted 'dark' is dropped); the user's choice persists from here on.
    { name: 'emazao-ui-v2', partialize: (s) => ({ theme: s.theme }) }
  )
)
