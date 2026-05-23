import { Link, Outlet, useLocation } from 'react-router-dom'
import { Users, ShieldCheck, AlertOctagon, BarChart3 } from 'lucide-react'

const nav = [
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/verification', label: 'Verification', icon: ShieldCheck },
  { to: '/admin/disputes', label: 'Disputes', icon: AlertOctagon },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
]

export default function Admin() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen">
      <div className="w-56 bg-[var(--c-card)] border-r border-[var(--c-border)] flex-shrink-0 p-4">
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
      <div className="flex-1 overflow-auto bg-[var(--c-bg)]">
        <Outlet />
      </div>
    </div>
  )
}
