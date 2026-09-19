import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Home, Search, Store, Clapperboard, MessageCircle, Bell, PlusSquare, Menu, User,
  Package, Wallet, FileText, HeartPulse, LayoutDashboard, ShieldCheck, Settings, MessageSquareHeart,
  Sun, Moon, LogOut, LogIn, Receipt, ShoppingBag,
} from 'lucide-react'
import { Wordmark } from '@/components/ui/Wordmark'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useUnreadStore } from '@/store/unreadStore'
import { useNotificationCount } from '@/hooks/useNotificationCount'
import { cn } from '@/lib/utils'

/** Sidebar widths: icon rail on laptops, labelled on wide screens. */
export const SIDEBAR_CLASSES = 'lg:ml-[76px] xl:ml-[244px]'

function Dot({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-[5px] rounded-full bg-red-500 text-white text-[10.5px] font-bold flex items-center justify-center ring-2 ring-[var(--c-rail)] tabular">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function Item({ to, icon: Icon, label, count = 0, onClick }: {
  to?: string; icon: typeof Home; label: string; count?: number; onClick?: () => void
}) {
  const inner = (active: boolean) => (
    <>
      <span className="relative flex-shrink-0">
        <Icon className="h-[26px] w-[26px] transition-transform group-hover:scale-105" strokeWidth={active ? 2.5 : 1.9} />
        <Dot count={count} />
      </span>
      <span className={cn('hidden xl:block text-[15.5px] truncate', active ? 'font-bold' : 'font-normal')}>{label}</span>
    </>
  )
  const cls = (active: boolean) => cn(
    'group relative flex items-center gap-4 h-12 px-3 rounded-xl transition-colors w-full justify-center xl:justify-start',
    active ? 'text-[var(--c-text)]' : 'text-[var(--c-text)] hover:bg-[var(--c-raised)]',
  )
  if (!to) return <button onClick={onClick} className={cls(false)} title={label}>{inner(false)}</button>
  return (
    <NavLink to={to} end={to === '/profile'} className={({ isActive }) => cls(isActive)} title={label}>
      {({ isActive }) => inner(isActive)}
    </NavLink>
  )
}

export const Sidebar = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const { theme, toggleTheme, setCreateOpen } = useUIStore()
  const unreadMessages = useUnreadStore(s => s.unreadMessages)
  const unread = useNotificationCount()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const isFarmer = user?.role === 'FARMER'
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e: MouseEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [moreOpen])

  const menuLink = (to: string, Icon: typeof Home, label: string) => (
    <button key={to} onClick={() => { setMoreOpen(false); navigate(to) }}
      className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[14.5px] text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-colors text-left">
      <Icon className="h-5 w-5 text-[var(--c-text-2)]" strokeWidth={1.9} /> {label}
    </button>
  )

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-30 w-[76px] xl:w-[244px] px-3 pt-6 pb-4 bg-[var(--c-rail)] border-r border-[var(--c-border)]">
      <NavLink to="/feed" className="h-[52px] mb-5 flex items-center justify-center xl:justify-start xl:px-3" aria-label="eMazao">
        <span className="xl:hidden"><img src="/emazao-mark.png?v=1" alt="" className="h-8 w-auto" /></span>
        <span className="hidden xl:block"><Wordmark size={32} /></span>
      </NavLink>

      <nav className="flex-1 flex flex-col gap-1">
        <Item to="/feed" icon={Home} label={t('nav.home')} />
        <Item to="/explore" icon={Search} label={t('nav.explore')} />
        <Item to="/marketplace" icon={Store} label={t('nav.market')} />
        <Item to="/reels" icon={Clapperboard} label={t('nav.reels')} />
        {user && <Item to="/messages" icon={MessageCircle} label={t('nav.messages')} count={unreadMessages} />}
        {user && <Item to="/notifications" icon={Bell} label={t('nav.alerts')} count={unread} />}
        {user && <Item icon={PlusSquare} label={t('nav.create')} onClick={() => setCreateOpen(true)} />}
        {user && (
          <NavLink to="/profile" end className={({ isActive }) => cn(
            'group flex items-center gap-4 h-12 px-3 rounded-xl hover:bg-[var(--c-raised)] justify-center xl:justify-start transition-colors',
            isActive && 'font-bold')} title={t('nav.profile')}>
            {({ isActive }) => (
              <>
                {user.avatar
                  ? <img src={user.avatar} alt="" className={cn('w-[26px] h-[26px] rounded-full object-cover', isActive && 'ring-2 ring-[var(--c-text)] ring-offset-1 ring-offset-[var(--c-rail)]')} />
                  : <User className="h-[26px] w-[26px]" />}
                <span className="hidden xl:block text-[15.5px] text-[var(--c-text)]">{t('nav.profile')}</span>
              </>
            )}
          </NavLink>
        )}
      </nav>

      {!user ? (
        <NavLink to="/login"
          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-emerald transition-colors">
          <LogIn className="h-[18px] w-[18px]" /><span className="hidden xl:inline">{t('nav.signIn')}</span>
        </NavLink>
      ) : (
        <div className="relative" ref={moreRef}>
          <Item icon={Menu} label={t('nav.more')} onClick={() => setMoreOpen(o => !o)} />
          <AnimatePresence>
            {moreOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="absolute bottom-full left-0 mb-2 w-[266px] p-2 rounded-2xl bg-[var(--c-card)] border border-[var(--c-border)] shadow-[var(--shadow-float)] z-50"
              >
                {menuLink('/orders', Package, t('nav.orders'))}
                {menuLink('/cart', ShoppingBag, t('nav.cart'))}
                {menuLink('/wallet', Wallet, t('nav.wallet'))}
                {menuLink('/requirements', FileText, t('nav.requirements'))}
                {menuLink('/nutrition', HeartPulse, t('nav.nutrition'))}
                {isFarmer && menuLink('/dashboard', LayoutDashboard, t('nav.dashboard'))}
                {isAdmin && menuLink('/admin/overview', ShieldCheck, 'Admin panel')}
                {isAdmin && menuLink('/admin/transactions', Receipt, 'Transactions')}
                <div className="h-px bg-[var(--c-border)] my-1.5 mx-2" />
                {menuLink('/settings', Settings, t('nav.settings'))}
                {menuLink('/feedback', MessageSquareHeart, t('nav.feedback'))}
                <button onClick={toggleTheme}
                  className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[14.5px] text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-colors">
                  {theme === 'dark' ? <Sun className="h-5 w-5 text-[var(--c-text-2)]" /> : <Moon className="h-5 w-5 text-[var(--c-text-2)]" />}
                  {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                </button>
                <div className="px-1 py-1"><LanguageSwitcher variant="compact" /></div>
                <div className="h-px bg-[var(--c-border)] my-1.5 mx-2" />
                <button onClick={() => { clearAuth(); navigate('/login') }}
                  className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[14.5px] text-red-500 hover:bg-red-500/10 transition-colors">
                  <LogOut className="h-5 w-5" /> {t('nav.signOut')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </aside>
  )
}
