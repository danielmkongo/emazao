import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Store, Plus, Clapperboard, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

/** Height of the bar itself, not counting the safe area under it. */
export const BOTTOM_NAV_HEIGHT = 56

const tabs = [
  { icon: Home,         label: 'nav.home',   href: '/feed' },
  { icon: Store,        label: 'nav.market', href: '/marketplace' },
  { icon: Clapperboard, label: 'nav.reels',  href: '/reels' },
]

/**
 * Five places, the number Instagram and TikTok settled on: home, market,
 * make something, reels, you. Everything else is one tap from the top bar or
 * your profile. The labels stay — plenty of people here are new to apps and
 * an icon alone is a guess.
 */
export const BottomNav = ({ variant = 'default' }: { variant?: 'default' | 'dark' }) => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const setCreateOpen = useUIStore(s => s.setCreateOpen)
  const navigate = useNavigate()
  const dark = variant === 'dark'

  const tab = (href: string, label: string, icon: React.ReactNode, activeIcon?: React.ReactNode) => (
    <NavLink to={href} className="flex-1 h-full" aria-label={t(label)}>
      {({ isActive }) => (
        <span className={cn(
          'relative h-full flex flex-col items-center justify-center gap-[3px] press',
          dark ? (isActive ? 'text-white' : 'text-white/60') : (isActive ? 'text-[var(--c-text)]' : 'text-[var(--c-text-3)]'),
        )}>
          {isActive && activeIcon ? activeIcon : icon}
          <span className={cn('text-[10.5px] leading-none', isActive ? 'font-semibold' : 'font-medium')}>{t(label)}</span>
          {isActive && (
            <motion.span layoutId="bottom-nav-dot" className="absolute top-1 w-1 h-1 rounded-full bg-brand-green"
              transition={{ type: 'spring', stiffness: 600, damping: 40 }} />
          )}
        </span>
      )}
    </NavLink>
  )

  const iconProps = (active = false) => ({ className: 'h-[25px] w-[25px]', strokeWidth: active ? 2.4 : 1.9 })

  return (
    <nav
      className={cn(
        'lg:hidden fixed bottom-0 inset-x-0 z-30 border-t',
        dark ? 'bg-black border-white/10' : 'bar-surface border-[var(--c-border-sub)]',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch px-1" style={{ height: BOTTOM_NAV_HEIGHT }}>
        {tab(tabs[0].href, tabs[0].label, <Home {...iconProps()} />, <Home {...iconProps(true)} fill="currentColor" fillOpacity={0.14} />)}
        {tab(tabs[1].href, tabs[1].label, <Store {...iconProps()} />, <Store {...iconProps(true)} />)}

        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => (user ? setCreateOpen(true) : navigate('/login'))}
            aria-label={t('nav.create')}
            className={cn(
              'w-[46px] h-[34px] rounded-[11px] flex items-center justify-center press',
              'bg-gradient-to-r from-harvest via-brand-lime to-brand-green shadow-[0_4px_14px_-4px_rgba(22,163,74,0.6)]',
            )}
          >
            <span className={cn('w-[38px] h-[28px] rounded-[8px] flex items-center justify-center', dark ? 'bg-white text-black' : 'bg-[var(--c-text)] text-[var(--c-bg)]')}>
              <Plus className="h-5 w-5" strokeWidth={2.8} />
            </span>
          </button>
        </div>

        {tab(tabs[2].href, tabs[2].label, <Clapperboard {...iconProps()} />, <Clapperboard {...iconProps(true)} />)}

        <NavLink to="/profile" className="flex-1 h-full" aria-label={t('nav.profile')}>
          {({ isActive }) => (
            <span className={cn(
              'relative h-full flex flex-col items-center justify-center gap-[3px] press',
              dark ? (isActive ? 'text-white' : 'text-white/60') : (isActive ? 'text-[var(--c-text)]' : 'text-[var(--c-text-3)]'),
            )}>
              {user?.avatar ? (
                <img src={user.avatar} alt="" className={cn('w-[26px] h-[26px] rounded-full object-cover',
                  isActive ? (dark ? 'ring-2 ring-white' : 'ring-2 ring-[var(--c-text)]') : '')} />
              ) : (
                <User {...iconProps(isActive)} />
              )}
              <span className={cn('text-[10.5px] leading-none', isActive ? 'font-semibold' : 'font-medium')}>{t('nav.profile')}</span>
            </span>
          )}
        </NavLink>
      </div>
    </nav>
  )
}
