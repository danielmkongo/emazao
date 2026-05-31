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

// One nav row. The active indicator is filled with the CONTENT background colour and
// runs flush to the sidebar's inner (left) edge, so the selected item visually blends
// into — and touches — the content area, rounded only on the interior side.
function NavRow({ icon: Icon, label, href }: { icon: typeof Home; label: string; href: string }) {
  return (
    <NavLink to={href} className="relative block">
      {({ isActive }) => (
        <div className="relative flex items-center gap-3 pl-6 pr-4 py-2.5 text-[15px]">
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-y-1 left-0 right-3 bg-[var(--c-bg)] rounded-r-[20px]"
              transition={{ type: 'spring', stiffness: 480, damping: 40 }}
            />
          )}
          <Icon className={cn('relative z-10 h-5 w-5 flex-shrink-0 transition-colors', isActive ? 'text-brand-green' : 'text-[var(--c-text-3)] group-hover:text-[var(--c-text)]')} />
          <span
            className={cn('relative z-10 font-display transition-colors', isActive ? 'text-brand-green font-bold' : 'text-[var(--c-text-2)] font-semibold group-hover:text-[var(--c-text)]')}
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

  return (
    <motion.aside
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="hidden lg:flex flex-col fixed right-0 top-0 bottom-0 w-64 z-30 pl-0 pr-0 pb-5 bg-[var(--c-card)] shadow-[-10px_0_30px_-12px_rgba(0,0,0,0.10)] transition-colors duration-200"
    >
      {/* Logo header — generous breathing room below it before the nav starts */}
      <NavLink to="/feed" className="flex items-center justify-start pl-4 pt-6 pb-10">
        <Logo className="h-44 w-auto" />
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar space-y-7">
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="pl-6 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-text-4)]">
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
            <p className="pl-6 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-text-4)]">
              Farm Tools
            </p>
            <div className="space-y-1 px-3">
              <NavLink
                to="/live"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[15px] font-semibold transition-colors',
                    isActive
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                      : 'text-[var(--c-text-2)] hover:bg-red-500/8 hover:text-red-500'
                  )
                }
                style={{ fontFamily: 'var(--font-display)' }}
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
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[15px] font-semibold transition-colors',
                    isActive
                      ? 'bg-gold text-white shadow-lg shadow-gold/30'
                      : 'text-[var(--c-text-2)] hover:bg-gold/10 hover:text-gold'
                  )
                }
                style={{ fontFamily: 'var(--font-display)' }}
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
      <div className="px-3 pt-4 mt-2 border-t border-[var(--c-border)] space-y-2">
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
