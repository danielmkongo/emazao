import { Link, Outlet, useLocation } from 'react-router-dom'
import { Users, ShieldCheck, AlertOctagon, BarChart3, FileText } from 'lucide-react'

const nav = [
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/verification', label: 'Verification', icon: ShieldCheck },
  { to: '/admin/disputes', label: 'Disputes', icon: AlertOctagon },
  { to: '/admin/content', label: 'Content', icon: FileText },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
]

export default function Admin() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-56 bg-brand-800 border-r border-white/[0.06] flex-shrink-0 p-4">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4 px-2">Admin Panel</p>
        <nav className="space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === to ? 'bg-brand-green text-white' : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
