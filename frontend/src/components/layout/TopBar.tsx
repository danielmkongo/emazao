import { Link } from 'react-router-dom'
import { Bell, Search, Sun, Moon, Settings } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
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

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 glass-dark border-b border-[var(--c-border)] px-4 py-3 flex items-center gap-3 transition-colors duration-200">
      <Link to="/feed" className="flex items-center mr-auto">
        <Logo className="h-14 w-auto" />
      </Link>

      <Button variant="ghost" size="icon-sm" onClick={() => setSearchOpen(true)}>
        <Search className="h-5 w-5 text-[var(--c-text-2)]" />
      </Button>

      <Button variant="ghost" size="icon-sm" onClick={toggleTheme}>
        {theme === 'dark'
          ? <Sun className="h-5 w-5 text-[var(--c-text-2)]" />
          : <Moon className="h-5 w-5 text-[var(--c-text-2)]" />
        }
      </Button>

      <Link to="/notifications">
        <Button variant="ghost" size="icon-sm" className="relative">
          <Bell className="h-5 w-5 text-[var(--c-text-2)]" />
          {(notifData?.unreadCount ?? 0) > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand-green" />
          )}
        </Button>
      </Link>

      <Link to="/settings">
        <Button variant="ghost" size="icon-sm">
          <Settings className="h-5 w-5 text-[var(--c-text-2)]" />
        </Button>
      </Link>

      <Link to="/profile">
        <Avatar src={user?.avatar} name={user?.name} size="sm" verified={user?.isVerified} />
      </Link>
    </header>
  )
}
