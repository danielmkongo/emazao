import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Package, ShoppingBag, Wallet, FileText, HeartPulse, LayoutDashboard, ShieldCheck, Receipt,
  Settings, MessageSquareHeart, Sun, Moon, LogOut, Bookmark, ChevronRight,
} from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

/**
 * Everything that is not one of the main tabs: orders, wallet, requests,
 * special nutrition, the seller dashboard, settings. One list, shown as the
 * desktop sidebar's "More" popover and as the phone's profile menu sheet, so
 * the two can never offer different things.
 */
export function AppMenuList({ onDone, rows = 'compact' }: { onDone: () => void; rows?: 'compact' | 'large' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const { theme, toggleTheme } = useUIStore()
  const isFarmer = user?.role === 'FARMER'
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const large = rows === 'large'

  const row = large
    ? 'w-full flex items-center gap-3.5 px-4 h-[52px] text-[15.5px] text-[var(--c-text)] active:bg-[var(--c-raised)] hover:bg-[var(--c-raised)] transition-colors text-left'
    : 'w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[14.5px] text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-colors text-left'
  const iconCls = large ? 'h-[22px] w-[22px] text-[var(--c-text)]' : 'h-5 w-5 text-[var(--c-text-2)]'

  const link = (to: string, Icon: typeof Package, label: string) => (
    <button key={to} onClick={() => { onDone(); navigate(to) }} className={row}>
      <Icon className={iconCls} strokeWidth={1.9} />
      <span className="flex-1">{label}</span>
      {large && <ChevronRight className="h-4 w-4 text-[var(--c-text-4)]" />}
    </button>
  )
  const divider = <div className={large ? 'h-2 bg-[var(--c-input)]' : 'h-px bg-[var(--c-border)] my-1.5 mx-2'} />

  return (
    <>
      {isFarmer && link('/dashboard', LayoutDashboard, t('nav.dashboard'))}
      {link('/orders', Package, t('nav.orders'))}
      {link('/cart', ShoppingBag, t('nav.cart'))}
      {link('/wallet', Wallet, t('nav.wallet'))}
      {link('/requirements', FileText, t('nav.requirements'))}
      {link('/nutrition', HeartPulse, t('nav.nutrition'))}
      {large && link('/profile?tab=saved', Bookmark, t('common.saved'))}
      {isAdmin && link('/admin/overview', ShieldCheck, 'Admin panel')}
      {isAdmin && link('/admin/transactions', Receipt, 'Transactions')}
      {divider}
      {link('/settings', Settings, t('nav.settings'))}
      {link('/feedback', MessageSquareHeart, t('nav.feedback'))}
      <button onClick={toggleTheme} className={row}>
        {theme === 'dark' ? <Sun className={iconCls} strokeWidth={1.9} /> : <Moon className={iconCls} strokeWidth={1.9} />}
        <span className="flex-1">{theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}</span>
      </button>
      <div className={large ? 'px-4 py-2' : 'px-1 py-1'}><LanguageSwitcher variant="compact" /></div>
      {divider}
      <button onClick={() => { onDone(); clearAuth(); navigate('/login') }}
        className={`${row} !text-red-500`}>
        <LogOut className={large ? 'h-[22px] w-[22px]' : 'h-5 w-5'} strokeWidth={1.9} />
        <span className="flex-1">{t('nav.signOut')}</span>
      </button>
    </>
  )
}

/** The phone version: a sheet that rises from the bottom, like Instagram's menu. */
export function AppMenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Menu">
          <motion.div className="absolute inset-0 bg-[var(--c-overlay)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="relative w-full md:max-w-md bg-[var(--c-card)] rounded-t-[26px] max-h-[88vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+10px)]"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 460, damping: 42 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) onClose() }}
          >
            <div className="w-10 h-1 rounded-full bg-[var(--c-border)] mx-auto mt-2.5 mb-2" />
            <AppMenuList onDone={onClose} rows="large" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
