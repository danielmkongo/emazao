import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Search, Play, MessageSquare, User, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const buyerTabs = [
  { icon: Home,          label: 'Feed',     href: '/feed' },
  { icon: Search,        label: 'Explore',  href: '/explore' },
  { icon: Play,          label: 'Reels',    href: '/reels' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
]

const farmerTabs = [
  { icon: Home,          label: 'Feed',     href: '/feed' },
  { icon: Play,          label: 'Reels',    href: '/reels' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
]

export const BottomNav = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const isFarmer = user?.role === 'FARMER'
  const tabs = isFarmer ? farmerTabs : buyerTabs

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass-dark border-t border-[var(--c-border)] safe-area-pb transition-colors duration-200">
      <div className="flex items-center justify-around py-2">
        {tabs.map(({ icon: Icon, label, href }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium transition-all',
                isActive ? 'text-brand-green' : 'text-[var(--c-text-3)]'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-5 w-5', isActive && 'drop-shadow-[0_0_8px_rgba(22,163,74,0.5)]')} />
                {label}
              </>
            )}
          </NavLink>
        ))}

        {/* Go Live — farmers get a prominent centre button */}
        {isFarmer && (
          <button
            onClick={() => navigate('/live')}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-red-400 transition-all active:scale-95"
          >
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
              <Radio className="h-4 w-4 text-white" />
            </div>
            Live
          </button>
        )}

        {/* Profile tab */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium transition-all',
              isActive ? 'text-brand-green' : 'text-[var(--c-text-3)]'
            )
          }
        >
          {({ isActive }) => (
            <>
              <User className={cn('h-5 w-5', isActive && 'drop-shadow-[0_0_8px_rgba(22,163,74,0.5)]')} />
              Profile
            </>
          )}
        </NavLink>
      </div>
    </nav>
  )
}
