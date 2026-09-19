import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShoppingBag } from 'lucide-react'
import { Sidebar, SIDEBAR_CLASSES } from './Sidebar'
import { RightPanel } from './RightPanel'
import { BottomNav } from './BottomNav'
import { TopBar, CountBadge } from './TopBar'
import { CreateSheet } from './CreateSheet'
import { InstallPrompt } from './InstallPrompt'
import { useCart } from '@/hooks/useCart'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

/** Laptop widths have no right panel, so the cart floats in the corner. */
function CornerCart() {
  const { t } = useTranslation()
  const { cart } = useCart()
  const user = useAuthStore(s => s.user)
  if (!user) return null
  return (
    <Link to="/cart" aria-label={t('nav.cart')} title={t('nav.cart')}
      className="hidden lg:flex xl:hidden fixed top-4 right-5 z-30 w-11 h-11 rounded-full bar-surface border border-[var(--c-border)] shadow-[var(--shadow-float)] items-center justify-center text-[var(--c-text)] press">
      <ShoppingBag className="h-[21px] w-[21px]" strokeWidth={1.9} />
      <CountBadge count={cart.itemCount} className="bg-brand-green" />
    </Link>
  )
}

export const MainLayout = () => (
  <div className="min-h-screen bg-[var(--c-bg)] overflow-x-clip">
    {/* Fills the notch / status-bar area in a standalone PWA so the clock and
        battery sit on the app's own bar colour. */}
    <div className="lg:hidden fixed top-0 inset-x-0 z-40 status-band" style={{ height: 'env(safe-area-inset-top, 0px)' }} />

    <Sidebar />
    <RightPanel />
    <TopBar />
    <CornerCart />

    <main className={cn(SIDEBAR_CLASSES, 'xl:mr-80 min-h-screen pt-[calc(56px+env(safe-area-inset-top,0px))] lg:pt-0 pb-[calc(56px+env(safe-area-inset-bottom,0px))] lg:pb-0')}>
      <Outlet />
    </main>

    <BottomNav />
    <CreateSheet />
    <InstallPrompt />
  </div>
)
