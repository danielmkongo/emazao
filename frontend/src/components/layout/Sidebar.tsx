import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home, Search, ShoppingBag, FileText, Play, MessageSquare,
  Package, Wallet, Bell, Settings, LogOut, LogIn, Sun, Moon, Radio, LayoutDashboard, Plus,
  ShieldCheck, Receipt,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useUnreadStore } from '@/store/unreadStore'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

// Labels are i18n keys resolved at render time so a language switch re-renders
// the nav without a reload.
const navGroups = [
  {
    label: 'nav.discover',
    items: [
      { icon: Home,        label: 'nav.feed',        href: '/feed' },
      { icon: Search,      label: 'nav.explore',     href: '/explore' },
      { icon: Play,        label: 'nav.reels',       href: '/reels' },
      { icon: ShoppingBag, label: 'nav.marketplace', href: '/marketplace' },
    ],
  },
  {
    label: 'nav.trade',
    items: [
      { icon: FileText, label: 'nav.requirements', href: '/requirements' },
      { icon: Package,  label: 'nav.orders',       href: '/orders' },
      { icon: Wallet,   label: 'nav.wallet',       href: '/wallet' },
    ],
  },
  {
    label: 'nav.connect',
    items: [
      { icon: MessageSquare, label: 'nav.messages', href: '/messages' },
      { icon: Bell,          label: 'nav.alerts',   href: '/notifications' },
    ],
  },
]

// A single menu item — compact row, icon + label, neutral filled active state with
// a green icon accent. This is the shadcn/Linear pattern: calm, legible, no gimmicks.
function MenuItem({ icon: Icon, label, href, badge }: { icon: typeof Home; label: string; href: string; badge?: number }) {
  const { t } = useTranslation()
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
          <span className="truncate flex-1">{t(label)}</span>
          {!!badge && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export const Sidebar = () => {
  const { t } = useTranslation()
  const { user, clearAuth } = useAuthStore()
  const { theme, toggleTheme } = useUIStore()
  const unreadMessages = useUnreadStore((s) => s.unreadMessages)
  const navigate = useNavigate()
  const isFarmer = user?.role === 'FARMER'
  // The admin panel had no entry point anywhere in the app — it could only be
  // reached by typing /admin into the address bar, which meant staff could sign
  // in and reasonably conclude it did not exist.
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const cta = isFarmer
    ? { label: t('nav.shareReel'), href: '/dashboard/reels' }
    : { label: t('nav.postRequirement'), href: '/requirements/post' }

  return (
    <motion.aside
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 z-30 bg-[var(--c-rail)] border-r border-[var(--c-border)] transition-colors duration-200"
      style={{ fontFamily: 'var(--font-nav)' }}
    >
      {/* Brand */}
      <NavLink to="/feed" className="flex items-center justify-center pt-6 pb-5 flex-shrink-0">
        <Logo className="h-20 w-auto" />
      </NavLink>

      {/* Primary action */}
      <div className="px-3 pb-3 flex-shrink-0">
        <NavLink
          to={cta.href}
          className="flex items-center gap-3 px-2.5 h-9 rounded-md bg-brand-green text-white text-sm font-semibold hover:bg-brand-emerald transition-colors"
        >
          <Plus className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2.5} /> {cta.label}
        </NavLink>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 pb-2 space-y-4">
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="px-2.5 h-7 flex items-center text-[11px] font-medium uppercase tracking-wider text-[var(--c-text-4)]">
              {t(label)}
            </p>
            <div className="space-y-0.5">
              {items.map(item => (
                <MenuItem key={item.href} {...item} badge={item.href === '/messages' ? unreadMessages : undefined} />
              ))}
            </div>
          </div>
        ))}

        {isFarmer && (
          <div>
            <p className="px-2.5 h-7 flex items-center text-[11px] font-medium uppercase tracking-wider text-[var(--c-text-4)]">
              {t('nav.farmTools')}
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
                <span className="flex-1">{t('nav.goLive')}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              </NavLink>
              <MenuItem icon={LayoutDashboard} label="nav.dashboard" href="/dashboard" />
            </div>
          </div>
        )}

        {isAdmin && (
          <div>
            <p className="px-2.5 h-7 flex items-center text-[11px] font-medium uppercase tracking-wider text-[var(--c-text-4)]">
              Admin
            </p>
            <div className="space-y-0.5">
              <NavLink
                to="/admin/overview"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-2.5 h-9 text-sm transition-colors',
                    isActive ? 'bg-brand-green/10 text-brand-green font-medium' : 'text-[var(--c-text-2)] hover:bg-[var(--c-raised)]/60 hover:text-[var(--c-text)]'
                  )
                }
              >
                <ShieldCheck className="h-[18px] w-[18px] flex-shrink-0 text-brand-green" strokeWidth={2} />
                <span className="flex-1">Admin panel</span>
              </NavLink>
              <NavLink
                to="/admin/transactions"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-2.5 h-9 text-sm transition-colors',
                    isActive ? 'bg-brand-green/10 text-brand-green font-medium' : 'text-[var(--c-text-2)] hover:bg-[var(--c-raised)]/60 hover:text-[var(--c-text)]'
                  )
                }
              >
                <Receipt className="h-[18px] w-[18px] flex-shrink-0 text-[var(--c-text-3)]" strokeWidth={2} />
                <span className="flex-1">Transactions</span>
              </NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[var(--c-border)] space-y-1.5 flex-shrink-0">
        <LanguageSwitcher variant="compact" />
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 rounded-md px-2.5 h-9 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-raised)]/60 hover:text-[var(--c-text)] transition-colors"
        >
          {theme === 'dark'
            ? <Sun className="h-[18px] w-[18px] text-[var(--c-text-3)]" strokeWidth={2} />
            : <Moon className="h-[18px] w-[18px] text-[var(--c-text-3)]" strokeWidth={2} />}
          {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
        </button>

        {/* Account — public pages render this same sidebar with no signed-in user,
            which previously showed an empty avatar and a bare "@". Offer sign-in
            instead. */}
        {!user ? (
          <NavLink
            to="/login"
            className="flex items-center justify-center gap-2 rounded-md px-2 h-12 bg-brand-green text-white text-sm font-semibold hover:bg-brand-green/90 transition-colors"
          >
            <LogIn className="h-[17px] w-[17px]" strokeWidth={2} />
            {t('nav.signIn')}
          </NavLink>
        ) : (
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
        )}
      </div>
    </motion.aside>
  )
}
