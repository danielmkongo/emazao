import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home, Search, ShoppingBag, FileText, Play, MessageSquare,
  Package, Wallet, Bell, Settings, LogOut, Sun, Moon, Radio, LayoutDashboard,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Discover',
    items: [
      { icon: Home,        label: 'Feed',        href: '/feed' },
      { icon: Search,      label: 'Explore',     href: '/explore' },
      { icon: Play,        label: 'Reels',       href: '/reels' },
      { icon: ShoppingBag, label: 'Marketplace', href: '/marketplace' },
    ],
  },
  {
    label: 'Trade',
    items: [
      { icon: FileText, label: 'Requirements', href: '/requirements' },
      { icon: Package,  label: 'Orders',       href: '/orders' },
      { icon: Wallet,   label: 'Wallet',       href: '/wallet' },
    ],
  },
  {
    label: 'Connect',
    items: [
      { icon: MessageSquare, label: 'Messages', href: '/messages' },
      { icon: Bell,          label: 'Alerts',   href: '/notifications' },
    ],
  },
]

// One nav row with a shared sliding gradient indicator (layoutId)
function NavRow({ icon: Icon, label, href }: { icon: typeof Home; label: string; href: string }) {
  return (
    <NavLink to={href} className="relative block">
      {({ isActive }) => (
        <div className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium">
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-green to-brand-emerald shadow-lg shadow-brand-green/30"
              transition={{ type: 'spring', stiffness: 480, damping: 40 }}
            />
          )}
          <Icon className={cn('relative z-10 h-5 w-5 flex-shrink-0 transition-colors', isActive ? 'text-white' : 'text-[var(--c-text-3)] group-hover:text-[var(--c-text)]')} />
          <span className={cn('relative z-10 transition-colors', isActive ? 'text-white font-semibold' : 'text-[var(--c-text-2)]')}>{label}</span>
        </div>
      )}
    </NavLink>
  )
}

export const Sidebar = () => {
  const { user, clearAuth } = useAuthStore()
  const { theme, toggleTheme } = useUIStore()
  const navigate = useNavigate()
  const isFarmer = user?.role === 'FARMER'

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 z-30 px-3.5 pb-5 bg-[var(--c-card)] border-r border-[var(--c-border)] transition-colors duration-200"
    >
      {/* Logo header */}
      <NavLink to="/feed" className="flex items-center justify-center pt-4 pb-3">
        <Logo className="h-44 w-auto" />
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar -mx-1 px-1 space-y-5">
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3.5 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--c-text-4)]">
              {label}
            </p>
            <div className="space-y-1">
              {items.map(item => (
                <div key={item.href} className="group">
                  <NavRow {...item} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Farmer-only tools — distinct accent treatment */}
        {isFarmer && (
          <div>
            <p className="px-3.5 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--c-text-4)]">
              Farm Tools
            </p>
            <div className="space-y-1">
              <NavLink
                to="/live"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                      : 'text-[var(--c-text-2)] hover:bg-red-500/8 hover:text-red-400'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Radio className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-white' : 'text-red-500')} />
                    Go Live
                    <span className={cn('ml-auto w-2 h-2 rounded-full flex-shrink-0 animate-pulse', isActive ? 'bg-white' : 'bg-red-500')} />
                  </>
                )}
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gold text-white shadow-lg shadow-gold/30'
                      : 'text-[var(--c-text-2)] hover:bg-gold/10 hover:text-gold'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <LayoutDashboard className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-white' : 'text-gold')} />
                    Dashboard
                  </>
                )}
              </NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom: theme toggle + user card */}
      <div className="pt-4 mt-2 border-t border-[var(--c-border)] space-y-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        {/* User card */}
        <div className="flex items-center gap-3 p-2 rounded-2xl bg-[var(--c-raised)]/60 border border-[var(--c-border)]">
          <NavLink to="/profile" className="flex items-center gap-3 flex-1 min-w-0 group">
            <Avatar src={user?.avatar} name={user?.name} size="sm" verified={user?.isVerified} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--c-text)] truncate group-hover:text-brand-green transition-colors">{user?.name}</p>
              <p className="text-xs text-[var(--c-text-3)] truncate">@{user?.username}</p>
            </div>
          </NavLink>
          <NavLink
            to="/settings"
            aria-label="Settings"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-card)] transition-colors flex-shrink-0"
          >
            <Settings className="h-4 w-4" />
          </NavLink>
          <button
            onClick={() => { clearAuth(); navigate('/login') }}
            aria-label="Sign out"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--c-text-3)] hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.aside>
  )
}
