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

const spring = { type: 'spring' as const, stiffness: 500, damping: 42 }

// Elegant + simple: plain icon, clean Manrope label, and a soft tinted highlight
// that slides between items. No chips, no gradients — just calm hierarchy.
function NavRow({ icon: Icon, label, href }: { icon: typeof Home; label: string; href: string }) {
  return (
    <NavLink to={href} className="relative block group" style={{ fontFamily: 'var(--font-nav)' }}>
      {({ isActive }) => (
        <div className="relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl">
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-xl bg-brand-green/10"
              transition={spring}
            />
          )}
          <Icon
            className={cn('relative z-10 h-[19px] w-[19px] flex-shrink-0 transition-colors', isActive ? 'text-brand-green' : 'text-[var(--c-text-3)] group-hover:text-[var(--c-text)]')}
            strokeWidth={isActive ? 2.4 : 1.9}
          />
          <span className={cn('relative z-10 text-[15px] transition-colors', isActive ? 'text-[var(--c-text)] font-semibold' : 'text-[var(--c-text-2)] font-medium group-hover:text-[var(--c-text)]')}>
            {label}
          </span>
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
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 z-30 bg-[var(--c-rail)] border-r border-[var(--c-border)] transition-colors duration-200"
      style={{ fontFamily: 'var(--font-nav)' }}
    >
      {/* Logo — centered, with breathing room */}
      <NavLink to="/feed" className="flex items-center justify-center pt-6 pb-7 flex-shrink-0">
        <Logo className="h-44 w-auto" />
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 space-y-6">
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-4)]">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(item => <NavRow key={item.href} {...item} />)}
            </div>
          </div>
        ))}

        {/* Farmer-only tools — kept subtle, with quiet accents */}
        {isFarmer && (
          <div>
            <p className="px-3.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-4)]">
              Farm Tools
            </p>
            <div className="space-y-0.5">
              <NavLink
                to="/live"
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[15px] transition-colors',
                    isActive ? 'bg-red-500/10 text-red-500 font-semibold' : 'text-[var(--c-text-2)] font-medium hover:bg-[var(--c-raised)]'
                  )
                }
              >
                <Radio className="h-[19px] w-[19px] flex-shrink-0 text-red-500" strokeWidth={1.9} />
                Go Live
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[15px] transition-colors',
                    isActive ? 'bg-gold/10 text-gold font-semibold' : 'text-[var(--c-text-2)] font-medium hover:bg-[var(--c-raised)]'
                  )
                }
              >
                <LayoutDashboard className="h-[19px] w-[19px] flex-shrink-0 text-gold" strokeWidth={1.9} />
                Dashboard
              </NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom: theme toggle + user */}
      <div className="px-3 pt-3 pb-4 mt-2 border-t border-[var(--c-border)] space-y-1.5 flex-shrink-0">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[15px] font-medium text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-[19px] w-[19px]" strokeWidth={1.9} /> : <Moon className="h-[19px] w-[19px]" strokeWidth={1.9} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        <div className="flex items-center gap-3 px-1.5 py-1.5">
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
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-colors flex-shrink-0"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </NavLink>
          <button
            onClick={() => { clearAuth(); navigate('/login') }}
            aria-label="Sign out"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--c-text-3)] hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </motion.aside>
  )
}
