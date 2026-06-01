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

// A single menu item — compact row, icon + label, neutral filled active state with
// a green icon accent. This is the shadcn/Linear pattern: calm, legible, no gimmicks.
function MenuItem({ icon: Icon, label, href }: { icon: typeof Home; label: string; href: string }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-2.5 h-9 text-sm transition-colors',
          isActive
            ? 'bg-[var(--c-raised)] text-[var(--c-text)] font-medium'
            : 'text-[var(--c-text-2)] hover:bg-[var(--c-raised)]/60 hover:text-[var(--c-text)]'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-[18px] w-[18px] flex-shrink-0', isActive ? 'text-brand-green' : 'text-[var(--c-text-3)]')} strokeWidth={2} />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export const Sidebar = () => {
  const { user, clearAuth } = useAuthStore()
  const { theme, toggleTheme } = useUIStore()
  const navigate = useNavigate()
  const isFarmer = user?.role === 'FARMER'

  const cta = isFarmer
    ? { label: 'Share a Reel', href: '/dashboard/reels' }
    : { label: 'Post a Requirement', href: '/requirements/post' }

  return (
    <motion.aside
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 z-30 bg-[var(--c-rail)] border-r border-[var(--c-border)] transition-colors duration-200"
      style={{ fontFamily: 'var(--font-nav)' }}
    >
      {/* Brand */}
      <NavLink to="/feed" className="flex items-center justify-center pt-6 pb-5 flex-shrink-0">
        <Logo className="h-40 w-auto" />
      </NavLink>

      {/* Primary action */}
      <div className="px-3 pb-3 flex-shrink-0">
        <NavLink
          to={cta.href}
          className="flex items-center justify-center gap-2 h-9 rounded-md bg-brand-green text-white text-sm font-semibold hover:bg-brand-emerald transition-colors"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> {cta.label}
        </NavLink>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 pb-2 space-y-4">
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="px-2.5 h-7 flex items-center text-[11px] font-medium uppercase tracking-wider text-[var(--c-text-4)]">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(item => <MenuItem key={item.href} {...item} />)}
            </div>
          </div>
        ))}

        {isFarmer && (
          <div>
            <p className="px-2.5 h-7 flex items-center text-[11px] font-medium uppercase tracking-wider text-[var(--c-text-4)]">
              Farm Tools
            </p>
            <div className="space-y-0.5">
              <NavLink
                to="/live"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-2.5 h-9 text-sm transition-colors',
                    isActive ? 'bg-red-500/10 text-red-500 font-medium' : 'text-[var(--c-text-2)] hover:bg-[var(--c-raised)]/60 hover:text-[var(--c-text)]'
                  )
                }
              >
                <Radio className="h-[18px] w-[18px] flex-shrink-0 text-red-500" strokeWidth={2} />
                <span className="flex-1">Go Live</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              </NavLink>
              <MenuItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" />
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[var(--c-border)] space-y-0.5 flex-shrink-0">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 rounded-md px-2.5 h-9 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-raised)]/60 hover:text-[var(--c-text)] transition-colors"
        >
          {theme === 'dark'
            ? <Sun className="h-[18px] w-[18px] text-[var(--c-text-3)]" strokeWidth={2} />
            : <Moon className="h-[18px] w-[18px] text-[var(--c-text-3)]" strokeWidth={2} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {/* Account */}
        <div className="flex items-center gap-2.5 rounded-md px-2 h-12 hover:bg-[var(--c-raised)]/60 transition-colors">
          <NavLink to="/profile" className="flex items-center gap-2.5 flex-1 min-w-0 group">
            <Avatar src={user?.avatar} name={user?.name} size="sm" verified={user?.isVerified} />
            <div className="flex-1 min-w-0 leading-tight">
              <p className="text-sm font-semibold text-[var(--c-text)] truncate">{user?.name}</p>
              <p className="text-xs text-[var(--c-text-3)] truncate">@{user?.username}</p>
            </div>
          </NavLink>
          <NavLink
            to="/settings"
            aria-label="Settings"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-card)] transition-colors flex-shrink-0"
          >
            <Settings className="h-[17px] w-[17px]" strokeWidth={2} />
          </NavLink>
          <button
            onClick={() => { clearAuth(); navigate('/login') }}
            aria-label="Sign out"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--c-text-3)] hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
          >
            <LogOut className="h-[17px] w-[17px]" strokeWidth={2} />
          </button>
        </div>
      </div>
    </motion.aside>
  )
}
