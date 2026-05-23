import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Search, Play, ShoppingBag, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const tabs = [
  { icon: Home,        label: 'Feed',    href: '/feed' },
  { icon: Search,      label: 'Explore', href: '/explore' },
  { icon: Play,        label: 'Reels',   href: '/reels' },
  { icon: ShoppingBag, label: 'Market',  href: '/marketplace' },
]

export const BottomNav = () => {
  const { user } = useAuthStore()

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
