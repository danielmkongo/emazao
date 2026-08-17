import { Link, Outlet, useLocation } from 'react-router-dom'
import { Users, ShieldCheck, ShieldAlert, AlertOctagon, BarChart3 } from 'lucide-react'

const nav = [
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/verification', label: 'Verification', icon: ShieldCheck },
  { to: '/admin/compliance', label: 'Compliance', icon: ShieldAlert },
  { to: '/admin/disputes', label: 'Disputes', icon: AlertOctagon },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
]

export default function Admin() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col w-56 bg-[var(--c-card)] border-r border-[var(--c-border)] flex-shrink-0 p-4">
        <p className="text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-widest mb-4 px-2">Admin Panel</p>
        <nav className="space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === to
                  ? 'bg-brand-green text-white'
                  : 'text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-input)]'
              }`}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile tab bar — replaces the sidebar below lg, where it would eat ~40% of the screen */}
      <nav className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 border-b border-[var(--c-border)] bg-[var(--c-card)]">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              pathname === to
                ? 'bg-brand-green text-white'
                : 'text-[var(--c-text-2)] bg-[var(--c-input)]'
            }`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </Link>
        ))}
      </nav>

      <div className="flex-1 overflow-auto bg-[var(--c-bg)]">
        <Outlet />
      </div>
    </div>
  )
}
