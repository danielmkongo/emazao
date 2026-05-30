import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home, Search, ShoppingBag, FileText, Play, MessageSquare,
  Package, Wallet, Bell, User, LayoutDashboard, LogOut, Sprout, Sun, Moon, Radio
} from 'lucide-react'
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

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer border-l-[3px]',
    isActive
      ? 'bg-brand-green/12 text-brand-green border-brand-green pl-[calc(0.75rem-3px)]'
      : 'text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)] border-transparent'
  )

export const Sidebar = () => {
  const { user, clearAuth } = useAuthStore()
  const { theme, toggleTheme } = useUIStore()
  const navigate = useNavigate()

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-[var(--c-card)] border-r border-[var(--c-border)] z-30 py-6 px-4 transition-colors duration-200"
    >
      {/* Logo */}
      <NavLink to="/feed" className="flex items-center px-2 mb-7 cursor-pointer">
        <img src="/emazaologo.png" alt="eMazao" className="h-10 w-auto object-contain" />
      </NavLink>

      {/* Nav groups */}
      <nav className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--c-text-4)]">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(({ icon: Icon, label: itemLabel, href }) => (
                <NavLink key={href} to={href} className={linkClass}>
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-brand-green' : '')} />
                      {itemLabel}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* Farmer-only tools */}
        {user?.role === 'FARMER' && (
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--c-text-4)]">
              Farm Tools
            </p>
            <div className="space-y-0.5">
              <NavLink
                to="/live"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer border-l-[3px]',
                    isActive
                      ? 'bg-red-500/10 text-red-400 border-red-400 pl-[calc(0.75rem-3px)]'
                      : 'text-[var(--c-text-2)] hover:text-red-400 hover:bg-red-500/5 border-transparent'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Radio className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-red-400' : 'text-red-400/50')} />
                    Go Live
                    <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  </>
                )}
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer border-l-[3px]',
                    isActive
                      ? 'bg-gold/12 text-gold border-gold pl-[calc(0.75rem-3px)]'
                      : 'text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)] border-transparent'
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
            </div>
          </div>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-[var(--c-border)] pt-4 space-y-1">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-all cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        <NavLink
          to="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--c-raised)] transition-colors cursor-pointer"
        >
          <Avatar src={user?.avatar} name={user?.name} size="sm" verified={user?.isVerified} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--c-text)] truncate">{user?.name}</p>
            <p className="text-xs text-[var(--c-text-3)] truncate">@{user?.username}</p>
          </div>
          <User className="h-4 w-4 text-[var(--c-text-4)] flex-shrink-0" />
        </NavLink>

        <button
          onClick={() => { clearAuth(); navigate('/login') }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--c-text-3)] hover:text-red-500 hover:bg-red-500/5 transition-all cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  )
}
