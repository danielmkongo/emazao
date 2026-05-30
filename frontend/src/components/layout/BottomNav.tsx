import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Search, Play, MessageSquare, User, Radio } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/avatar'

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
      <div className="flex items-center justify-around px-2 py-1.5">
        {tabs.map(({ icon: Icon, label, href }) => (
          <NavLink key={href} to={href}>
            {({ isActive }) => (
              <div className="relative flex flex-col items-center gap-0.5 px-3.5 py-2 rounded-xl cursor-pointer min-w-[48px]">
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-pill"
                    className="absolute inset-0 bg-brand-green/12 rounded-xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                  />
                )}
                <Icon className={cn(
                  'h-5 w-5 relative z-10 transition-colors',
                  isActive
                    ? 'text-brand-green drop-shadow-[0_0_8px_rgba(22,163,74,0.5)]'
                    : 'text-[var(--c-text-3)]'
                )} />
                <span className={cn(
                  'text-[10px] font-medium relative z-10 transition-colors',
                  isActive ? 'text-brand-green' : 'text-[var(--c-text-4)]'
                )}>
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}

        {/* Go Live — farmers get a prominent centre button */}
        {isFarmer && (
          <button
            onClick={() => navigate('/live')}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
              <Radio className="h-4 w-4 text-white" />
            </div>
            <span className="text-[10px] font-bold text-red-400">Live</span>
          </button>
        )}

        {/* Profile tab */}
        <NavLink to="/profile">
          {({ isActive }) => (
            <div className="relative flex flex-col items-center gap-0.5 px-3.5 py-2 rounded-xl cursor-pointer min-w-[48px]">
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-pill"
                  className="absolute inset-0 bg-brand-green/12 rounded-xl"
                  transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                />
              )}
              {user?.avatar ? (
                <div className={cn(
                  'relative z-10 rounded-full transition-all',
                  isActive ? 'ring-2 ring-brand-green ring-offset-1 ring-offset-transparent' : ''
                )}>
                  <Avatar src={user.avatar} name={user.name} size="xs" />
                </div>
              ) : (
                <User className={cn(
                  'h-5 w-5 relative z-10 transition-colors',
                  isActive
                    ? 'text-brand-green drop-shadow-[0_0_8px_rgba(22,163,74,0.5)]'
                    : 'text-[var(--c-text-3)]'
                )} />
              )}
              <span className={cn(
                'text-[10px] font-medium relative z-10 transition-colors',
                isActive ? 'text-brand-green' : 'text-[var(--c-text-4)]'
              )}>
                Profile
              </span>
            </div>
          )}
        </NavLink>
      </div>
    </nav>
  )
}
