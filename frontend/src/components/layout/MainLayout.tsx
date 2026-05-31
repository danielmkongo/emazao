import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { RightPanel } from './RightPanel'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'

export const MainLayout = () => (
  <div className="min-h-screen bg-[var(--c-bg)] transition-colors duration-200">
    {/* Mobile status-bar accent band — fills the notch / status-bar safe area with
        the brand accent so battery & network sit on the app colour (standalone PWA). */}
    <div
      className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-brand-green to-brand-emerald"
      style={{ height: 'env(safe-area-inset-top, 0px)' }}
    />

    {/* Left nav (desktop) · Right info panel (wide desktop) */}
    <Sidebar />
    <RightPanel />
    <TopBar />

    {/* Main content sits between the left sidebar (lg) and the right panel (xl). */}
    <main className="lg:ml-64 xl:mr-80 pt-[calc(84px_+_env(safe-area-inset-top))] lg:pt-0 pb-[92px] lg:pb-0 min-h-screen">
      <Outlet />
    </main>

    <BottomNav />
  </div>
)
