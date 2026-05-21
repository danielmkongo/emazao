import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home, Search, ShoppingBag, FileText, Play, MessageSquare,
  Package, Wallet, Bell, User, LayoutDashboard, LogOut, Sprout
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const navItems = [
  { icon: Home, label: 'Feed', href: '/feed' },
  { icon: Search, label: 'Explore', href: '/explore' },
  { icon: Play, label: 'Reels', href: '/reels' },
  { icon: ShoppingBag, label: 'Market', href: '/marketplace' },
  { icon: FileText, label: 'Requirements', href: '/requirements' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
  { icon: Package, label: 'Orders', href: '/orders' },
  { icon: Wallet, label: 'Wallet', href: '/wallet' },
  { icon: Bell, label: 'Alerts', href: '/notifications' },
]

export const Sidebar = () => {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-brand-dark border-r border-white/[0.06] z-30 py-6 px-4"
    >
      {/* Logo */}
      <NavLink to="/feed" className="flex items-center gap-2 px-2 mb-8">
        <div className="h-9 w-9 rounded-xl bg-brand-green flex items-center justify-center">
          <Sprout className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          EMAZAO
        </span>
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ icon: Icon, label, href }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-brand-green/15 text-brand-lime'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-brand-green' : '')} />
                {label}
              </>
            )}
          </NavLink>
        ))}

        {/* Dashboard link for farmers */}
        {(user?.role === 'FARMER') && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gold/15 text-gold'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              )
            }
          >
            {({ isActive }) => (
              <>
                <LayoutDashboard className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-gold' : '')} />
                Dashboard
              </>
            )}
          </NavLink>
        )}
      </nav>

      {/* User area */}
      <div className="border-t border-white/[0.06] pt-4 space-y-2">
        <NavLink
          to="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
        >
          <Avatar src={user?.avatar} name={user?.name} size="sm" verified={user?.isVerified} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/40 truncate">@{user?.username}</p>
          </div>
          <User className="h-4 w-4 text-white/30 flex-shrink-0" />
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  )
}
