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

function Tab({ icon: Icon, label, href }: { icon: typeof Home; label: string; href: string }) {
  return (
    <NavLink to={href} className="relative flex-1">
      {({ isActive }) => (
        <div className="relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[48px]">
          {isActive && (
            <motion.div
              layoutId="bottom-nav-pill"
              className="absolute inset-x-1.5 inset-y-0.5 rounded-2xl bg-gradient-to-b from-brand-green/20 to-brand-emerald/10 border border-brand-green/20"
              transition={{ type: 'spring', stiffness: 500, damping: 42 }}
            />
          )}
          <Icon className={cn('h-[22px] w-[22px] relative z-10 transition-colors', isActive ? 'text-brand-green' : 'text-[var(--c-text-3)]')} />
          <span className={cn('text-[10px] relative z-10 transition-colors', isActive ? 'text-brand-green font-semibold' : 'text-[var(--c-text-4)] font-medium')}>
            {label}
          </span>
        </div>
      )}
    </NavLink>
  )
}

export const BottomNav = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const isFarmer = user?.role === 'FARMER'
  const tabs = isFarmer ? farmerTabs : buyerTabs

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 pointer-events-none">
      <nav className="pointer-events-auto glass-dark rounded-[22px] border border-[var(--c-border)] shadow-xl shadow-black/10 flex items-center px-1.5">
        {tabs.map(t => <Tab key={t.href} {...t} />)}

        {/* Go Live — farmers get a prominent centre action */}
        {isFarmer && (
          <button
            onClick={() => navigate('/live')}
            aria-label="Go live"
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 active:scale-95 transition-transform flex-shrink-0"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/40">
              <Radio className="h-4 w-4 text-white" />
            </div>
            <span className="text-[10px] font-bold text-red-400">Live</span>
          </button>
        )}

        {/* Profile */}
        <NavLink to="/profile" className="relative flex-1">
          {({ isActive }) => (
            <div className="relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[48px]">
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-pill"
                  className="absolute inset-x-1.5 inset-y-0.5 rounded-2xl bg-gradient-to-b from-brand-green/20 to-brand-emerald/10 border border-brand-green/20"
                  transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                />
              )}
              {user?.avatar ? (
                <div className={cn('relative z-10 rounded-full transition-all', isActive && 'ring-2 ring-brand-green ring-offset-1 ring-offset-[var(--c-card)]')}>
                  <Avatar src={user.avatar} name={user.name} size="xs" />
                </div>
              ) : (
                <User className={cn('h-[22px] w-[22px] relative z-10 transition-colors', isActive ? 'text-brand-green' : 'text-[var(--c-text-3)]')} />
              )}
              <span className={cn('text-[10px] relative z-10 transition-colors', isActive ? 'text-brand-green font-semibold' : 'text-[var(--c-text-4)] font-medium')}>
                Profile
              </span>
            </div>
          )}
        </NavLink>
      </nav>
    </div>
  )
}
