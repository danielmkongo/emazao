import { Link } from 'react-router-dom'
import { Bell, Search, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

export const TopBar = () => {
  const { user } = useAuthStore()
  const { setSearchOpen } = useUIStore()

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 glass-dark border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
      <Link to="/feed" className="flex items-center gap-2 mr-auto">
        <div className="h-8 w-8 rounded-xl bg-brand-green flex items-center justify-center">
          <Sprout className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          EMAZAO
        </span>
      </Link>

      <Button variant="ghost" size="icon-sm" onClick={() => setSearchOpen(true)}>
        <Search className="h-5 w-5" />
      </Button>

      <Link to="/notifications">
        <Button variant="ghost" size="icon-sm" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand-green" />
        </Button>
      </Link>

      <Link to="/profile">
        <Avatar src={user?.avatar} name={user?.name} size="sm" verified={user?.isVerified} />
      </Link>
    </header>
  )
}
