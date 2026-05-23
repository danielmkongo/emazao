import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home, Search, ShoppingBag, FileText, Play, MessageSquare,
  Package, Wallet, Bell, User, LayoutDashboard, LogOut, Sprout, Sun, Moon
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const navItems = [
  { icon: Home,         label: 'Feed',         href: '/feed' },
  { icon: Search,       label: 'Explore',       href: '/explore' },
  { icon: Play,         label: 'Reels',         href: '/reels' },
  { icon: ShoppingBag,  label: 'Market',        href: '/marketplace' },
  { icon: FileText,     label: 'Requirements',  href: '/requirements' },
  { icon: MessageSquare,label: 'Messages',      href: '/messages' },
  { icon: Package,      label: 'Orders',        href: '/orders' },
  { icon: Wallet,       label: 'Wallet',        href: '/wallet' },
  { icon: Bell,         label: 'Alerts',        href: '/notifications' },
]

export const Sidebar = () => {
  const { user, clearAuth } = useAuthStore()
  const { theme, toggleTheme } = useUIStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-[var(--c-card)] border-r border-[var(--c-border)] z-30 py-6 px-4 transition-colors duration-200"
    >
      {/* Logo */}
      <NavLink to="/feed" className="flex items-center gap-2 px-2 mb-8">
        <div className="h-9 w-9 rounded-xl bg-brand-green flex items-center justify-center shadow-lg shadow-brand-green/20">
          <Sprout className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-display)' }}>
          eMazao
        </span>
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto no-scrollbar">
        {navItems.map(({ icon: Icon, label, href }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-green/12 text-brand-green'
                  : 'text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)]'
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

        {user?.role === 'FARMER' && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-gold/12 text-gold'
                  : 'text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)]'
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

      {/* Bottom actions */}
      <div className="border-t border-[var(--c-border)] pt-4 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-all"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        {/* Profile link */}
        <NavLink
          to="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--c-raised)] transition-colors"
        >
          <Avatar src={user?.avatar} name={user?.name} size="sm" verified={user?.isVerified} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--c-text)] truncate">{user?.name}</p>
            <p className="text-xs text-[var(--c-text-3)] truncate">@{user?.username}</p>
          </div>
          <User className="h-4 w-4 text-[var(--c-text-4)] flex-shrink-0" />
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--c-text-3)] hover:text-red-500 hover:bg-red-500/5 transition-all"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  )
}
