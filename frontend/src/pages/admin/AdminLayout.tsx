import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Receipt, Users, ShieldCheck, ShieldAlert,
  AlertOctagon, BarChart3, ScrollText, Settings2, ArrowLeft, Radio, Circle, Ban, UserSearch,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

/**
 * The admin console runs in its own chrome rather than inside MainLayout.
 *
 * It used to render as a page within the consumer shell, which meant an
 * operator resolving a dispute did so beside "Trending" hashtags and a "Hot
 * Products" rail, with the marketplace sidebar taking 256px and the info panel
 * another 320px. Running the platform and shopping on it are different jobs;
 * this gives the first one a surface built for scanning and acting, and hands
 * back the horizontal space the tables actually need.
 */

interface OverviewBadges {
  queues: { openDisputes: number; openFlags: number; pendingVerifications: number }
  liveNow: { broadcaster: string; viewerCount: number }[]
  pulse24h: { newUsers: number; orders: number; reels: number; messages: number }
}

const NAV = [
  {
    group: 'Monitor',
    items: [
      { to: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
      { to: '/admin/transactions', label: 'Transactions', icon: Receipt },
      { to: '/admin/customers', label: 'Customers', icon: UserSearch },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    group: 'Act',
    items: [
      { to: '/admin/disputes', label: 'Disputes', icon: AlertOctagon, badge: 'openDisputes' as const },
      { to: '/admin/compliance', label: 'Risk flags', icon: ShieldAlert, badge: 'openFlags' as const },
      { to: '/admin/verification', label: 'Verification', icon: ShieldCheck, badge: 'pendingVerifications' as const },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/bans', label: 'Blocked', icon: Ban },
    ],
  },
  {
    group: 'Govern',
    items: [
      { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
      { to: '/admin/settings', label: 'Settings', icon: Settings2 },
    ],
  },
]

export default function AdminLayout() {
  const { user } = useAuthStore()
  const { pathname } = useLocation()

  // Shared with the Overview page's own query, so opening the console costs one
  // request and the badges stay in step with the numbers on screen.
  const { data } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OverviewBadges>>('/admin/overview')
      return res.data.data
    },
    refetchInterval: 60_000,
  })

  const queues = data?.queues
  const pending = (queues?.openDisputes ?? 0) + (queues?.openFlags ?? 0) + (queues?.pendingVerifications ?? 0)
  const liveCount = data?.liveNow?.length ?? 0

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex flex-col">
      {/* Console bar — identity, live state, and the way back to the app. */}
      <header className="h-14 shrink-0 border-b border-[var(--c-border)] bg-[var(--c-card)] flex items-center gap-4 px-4 sticky top-0 z-30">
        <Link to="/feed" className="flex items-center gap-2 text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors shrink-0" title="Back to eMazao">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm hidden sm:inline">Back to app</span>
        </Link>

        <div className="h-5 w-px bg-[var(--c-border)] hidden sm:block" />

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-[var(--c-text)] tracking-tight">Operations</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">
            {user?.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}
          </span>
        </div>

        {/* Live counters, right-aligned. Tabular figures so they do not jitter
            as they tick between refreshes. */}
        <div className="ml-auto flex items-center gap-4 sm:gap-6 text-xs tabular-nums">
          {liveCount > 0 && (
            <span className="hidden md:flex items-center gap-1.5 text-red-500 font-medium">
              <Radio className="h-3.5 w-3.5" />
              {liveCount} live
            </span>
          )}
          <span className="hidden lg:flex items-center gap-1.5 text-[var(--c-text-3)]">
            <span className="text-[var(--c-text)] font-semibold">{formatNumber(data?.pulse24h?.orders ?? 0)}</span> orders/24h
          </span>
          <span className="hidden lg:flex items-center gap-1.5 text-[var(--c-text-3)]">
            <span className="text-[var(--c-text)] font-semibold">{formatNumber(data?.pulse24h?.newUsers ?? 0)}</span> signups/24h
          </span>
          <span className={`flex items-center gap-1.5 font-medium ${pending ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--c-text-3)]'}`}>
            <Circle className={`h-2 w-2 ${pending ? 'fill-amber-500 text-amber-500' : 'fill-brand-green text-brand-green'}`} />
            {pending ? `${pending} awaiting action` : 'All clear'}
          </span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Rail — grouped by what the operator is doing, not by data model. */}
        <nav className="hidden lg:flex flex-col w-52 shrink-0 border-r border-[var(--c-border)] bg-[var(--c-card)] py-4 gap-5 overflow-y-auto">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <p className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-4)]">{group}</p>
              <div className="px-2 space-y-0.5">
                {items.map(({ to, label, icon: Icon, badge }) => {
                  const count = badge && queues ? queues[badge] : 0
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm transition-colors ${
                          isActive
                            ? 'bg-brand-green text-white font-medium'
                            : 'text-[var(--c-text-2)] hover:bg-[var(--c-raised)] hover:text-[var(--c-text)]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{label}</span>
                          {count > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                              isActive ? 'bg-white/25 text-white' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            }`}>
                              {count}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Mobile: the same destinations as a scrolling strip. */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2 border-t border-[var(--c-border)] bg-[var(--c-card)]">
          {NAV.flatMap(g => g.items).map(({ to, label, icon: Icon, badge }) => {
            const count = badge && queues ? queues[badge] : 0
            const active = pathname === to
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active ? 'bg-brand-green text-white' : 'bg-[var(--c-input)] text-[var(--c-text-2)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold tabular-nums ${active ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`}>
                    {count}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <main className="flex-1 min-w-0 overflow-x-hidden pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
