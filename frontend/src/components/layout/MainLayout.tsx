import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'

export const MainLayout = () => (
  <div className="min-h-screen bg-[var(--c-bg)] transition-colors duration-200">
    <Sidebar />
    <TopBar />

    {/* Main content — offset for sidebar on desktop, top/bottom bars on mobile */}
    <main className="lg:ml-64 pt-[60px] lg:pt-0 pb-[92px] lg:pb-0 min-h-screen">
      <Outlet />
    </main>

    <BottomNav />
  </div>
)
