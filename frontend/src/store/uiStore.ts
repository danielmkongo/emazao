import { create } from 'zustand'

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

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  sidebarOpen: false,
  cartOpen: false,
  searchOpen: false,
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setCartOpen: (v) => set({ cartOpen: v }),
  setSearchOpen: (v) => set({ searchOpen: v }),
}))
