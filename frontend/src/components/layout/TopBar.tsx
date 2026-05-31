import { Link } from 'react-router-dom'
import { Bell, Search, Sun, Moon } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import api from '@/lib/api'

export const TopBar = () => {
  const { user } = useAuthStore()
  const { theme, toggleTheme, setSearchOpen } = useUIStore()

  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const res = await api.get<{ unreadCount: number }>('/notifications?limit=1')
      return res.data
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const unread = notifData?.unreadCount ?? 0

  const iconBtn = 'w-9 h-9 rounded-xl flex items-center justify-center text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-colors'

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 glass-dark border-b border-[var(--c-border)] px-3 h-20 flex items-center gap-1 transition-colors duration-200">
      <Link to="/feed" className="flex items-center mr-auto pl-1">
        <Logo className="h-[72px] w-auto" />
      </Link>

      <button onClick={() => setSearchOpen(true)} aria-label="Search" className={iconBtn}>
        <Search className="h-5 w-5" />
      </button>

      <button onClick={toggleTheme} aria-label="Toggle theme" className={iconBtn}>
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <Link to="/notifications" aria-label="Notifications" className={`${iconBtn} relative`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--c-bg)]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>

      <Link to="/profile" aria-label="Profile" className="ml-1 rounded-full ring-2 ring-transparent hover:ring-brand-green/30 transition-all">
        <Avatar src={user?.avatar} name={user?.name} size="sm" verified={user?.isVerified} />
      </Link>
    </header>
  )
}
