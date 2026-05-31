import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home, Search, ShoppingBag, FileText, Play, MessageSquare,
  Package, Wallet, Bell, Settings, LogOut, Sun, Moon, Radio, LayoutDashboard, Plus,
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

const spring = { type: 'spring' as const, stiffness: 480, damping: 40 }

// A nav row. Active state = a sliding tinted pill with a green accent bar on the left,
// the icon goes solid green, and the label uses the display font in bold.
function NavRow({ icon: Icon, label, href }: { icon: typeof Home; label: string; href: string }) {
  return (
    <NavLink to={href} className="relative block group">
      {({ isActive }) => (
        <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl">
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-xl bg-brand-green/12 border-l-[3px] border-brand-green"
              transition={spring}
            />
          )}
          <span className={cn(
            'relative z-10 grid place-items-center h-9 w-9 rounded-lg flex-shrink-0 transition-colors',
            isActive ? 'bg-brand-green text-white shadow-sm shadow-brand-green/30' : 'text-[var(--c-text-3)] group-hover:bg-[var(--c-raised)] group-hover:text-[var(--c-text)]'
          )}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span
            className={cn('relative z-10 text-[15px] transition-colors', isActive ? 'text-[var(--c-text)] font-bold' : 'text-[var(--c-text-2)] font-semibold group-hover:text-[var(--c-text)]')}
            style={{ fontFamily: 'var(--font-display)' }}
          >
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

  // Role-aware primary action
  const cta = isFarmer
    ? { label: 'Share a Reel', href: '/dashboard/reels', icon: Plus }
    : { label: 'Post a Requirement', href: '/requirements/post', icon: Plus }

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 z-30 bg-[var(--c-card)] border-r border-[var(--c-border)] transition-colors duration-200"
    >
      {/* Logo header (size unchanged) */}
      <NavLink to="/feed" className="flex items-center justify-start pl-4 pt-5 pb-6 flex-shrink-0">
        <Logo className="h-44 w-auto" />
      </NavLink>

      {/* Primary CTA */}
      <div className="px-3 pb-4 flex-shrink-0">
        <NavLink
          to={cta.href}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-green to-brand-emerald text-white text-sm font-bold shadow-lg shadow-brand-green/25 hover:shadow-brand-green/40 hover:brightness-105 active:scale-[0.98] transition-all"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <cta.icon className="h-4 w-4" /> {cta.label}
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 space-y-5">
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-text-4)]">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(item => <NavRow key={item.href} {...item} />)}
            </div>
          </div>
        ))}

        {/* Farmer-only tools */}
        {isFarmer && (
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-text-4)]">
              Farm Tools
            </p>
            <div className="space-y-0.5">
              <NavLink
                to="/live"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-semibold transition-colors',
                    isActive ? 'bg-red-500/12 text-red-500 border-l-[3px] border-red-500' : 'text-[var(--c-text-2)] hover:bg-[var(--c-raised)]'
                  )
                }
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span className="grid place-items-center h-9 w-9 rounded-lg bg-red-500/15 text-red-500 flex-shrink-0">
                  <Radio className="h-[18px] w-[18px]" />
                </span>
                Go Live
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-semibold transition-colors',
                    isActive ? 'bg-gold/12 text-gold border-l-[3px] border-gold' : 'text-[var(--c-text-2)] hover:bg-[var(--c-raised)]'
                  )
                }
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span className="grid place-items-center h-9 w-9 rounded-lg bg-gold/15 text-gold flex-shrink-0">
                  <LayoutDashboard className="h-[18px] w-[18px]" />
                </span>
                Dashboard
              </NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom: theme toggle + user card */}
      <div className="px-3 pt-3 pb-4 mt-2 border-t border-[var(--c-border)] space-y-2 flex-shrink-0">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

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
