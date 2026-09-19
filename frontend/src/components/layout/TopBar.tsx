import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, ShoppingBag, Bell, MessageCircle } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useNotificationCount } from '@/hooks/useNotificationCount'
import { useUnreadStore } from '@/store/unreadStore'
import { Wordmark } from '@/components/ui/Wordmark'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

/** A small count bubble. Nothing at all when there is nothing to count. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span className={cn(
      'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-[5px] rounded-full bg-red-500 text-white text-[10.5px] font-bold leading-none flex items-center justify-center ring-2 ring-[var(--c-bg)] tabular',
      className,
    )}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

/**
 * The phone's top bar. Instagram's restraint: the brand on the left, a few
 * quiet icons on the right that only light up when something needs you.
 * Theme and language live in settings — they are set once, not every visit.
 */
export const TopBar = () => {
  const { t } = useTranslation()
  const { cart } = useCart()
  const unread = useNotificationCount()
  const unreadMessages = useUnreadStore(s => s.unreadMessages)
  const signedIn = !!useAuthStore(s => s.user)

  const icon = 'relative w-10 h-10 rounded-full flex items-center justify-center text-[var(--c-text)] press'
  const active = ({ isActive }: { isActive: boolean }) => cn(icon, isActive && 'text-brand-green')

  return (
    <header
      className="lg:hidden fixed top-0 inset-x-0 z-30 bar-surface border-b border-[var(--c-border-sub)]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="h-14 flex items-center pl-3.5 pr-1.5">
        <Link to="/feed" aria-label="eMazao" className="mr-auto press">
          <Wordmark />
        </Link>
        <NavLink to="/explore" aria-label={t('nav.explore')} className={active}>
          <Search className="h-[23px] w-[23px]" strokeWidth={2} />
        </NavLink>
        {signedIn ? (
          <>
            <NavLink to="/cart" aria-label={t('nav.cart')} className={active}>
              <ShoppingBag className="h-[23px] w-[23px]" strokeWidth={2} />
              <CountBadge count={cart.itemCount} className="bg-brand-green" />
            </NavLink>
            <NavLink to="/notifications" aria-label={t('nav.alerts')} className={active}>
              <Bell className="h-[23px] w-[23px]" strokeWidth={2} />
              <CountBadge count={unread} />
            </NavLink>
            <NavLink to="/messages" aria-label={t('nav.messages')} className={active}>
              <MessageCircle className="h-[23px] w-[23px]" strokeWidth={2} />
              <CountBadge count={unreadMessages} />
            </NavLink>
          </>
        ) : (
          // Visitors browsing the public market see one clear way in rather
          // than icons that would each bounce them to the sign-in page.
          <Link to="/login" className="ml-1.5 mr-1 h-9 px-4 rounded-full bg-brand-green text-white text-[14px] font-semibold flex items-center press">
            {t('nav.signIn')}
          </Link>
        )}
      </div>
    </header>
  )
}
