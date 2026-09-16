import { useQuery } from '@tanstack/react-query'
import { Users, UserCheck, UserMinus, Wallet, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface DormantUser {
  _id: string
  name: string
  email: string
  phone?: string
  customerId?: string
  role: string
  createdAt: string
  lastSeenAt?: string
}

interface CustomerStats {
  joinedByMonth: { month: string; count: number }[]
  joinedByDay: { date: string; count: number }[]
  activity: { active24h: number; active7d: number; active30d: number; neverSeen: number }
  transacted: { buyers: number; sellers: number }
  dormant: DormantUser[]
  missingCustomerIds: number
}

function Stat({ label, value, sub, icon: Icon, accent = 'text-[var(--c-text-3)]' }: {
  label: string; value: string; sub?: string; icon: typeof Users; accent?: string
}) {
  return (
    <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[var(--c-text-3)] text-[11px] font-medium uppercase tracking-wider">{label}</p>
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
      </div>
      <p className="text-xl font-bold text-[var(--c-text)] tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[var(--c-text-4)] text-[11px] mt-1.5">{sub}</p>}
    </div>
  )
}

export default function AdminCustomers() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CustomerStats>>('/admin/customers')
      return res.data.data
    },
    refetchInterval: 120_000,
  })

  if (isLoading || !data) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-7 w-44 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </div>
    )
  }

  const { joinedByMonth, activity, transacted, dormant, missingCustomerIds } = data
  const maxMonth = Math.max(...joinedByMonth.map(m => m.count), 1)
  const totalJoined = joinedByMonth.reduce((s, m) => s + m.count, 0)

  return (
    <div className="p-5 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-lg font-bold text-[var(--c-text)]">Customers</h1>
        <p className="text-[var(--c-text-3)] text-xs mt-0.5">
          Who joined, who is still here, and who has stopped coming back.
        </p>
      </div>

      {missingCustomerIds > 0 && (
        <div className="flex items-start gap-3 bg-amber-500/[0.07] border border-amber-500/30 rounded-lg p-3.5">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[var(--c-text-2)] text-sm">
            <strong className="text-[var(--c-text)]">{formatNumber(missingCustomerIds)}</strong> account(s) have no
            customer ID — they predate the field. Run <code className="text-xs bg-[var(--c-raised)] px-1 py-0.5 rounded">npm run backfill:customer-ids</code> on
            the server to assign them.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Active · 24h" value={formatNumber(activity.active24h)} icon={UserCheck} accent="text-brand-green" />
        <Stat label="Active · 7d" value={formatNumber(activity.active7d)} icon={UserCheck} accent="text-brand-green" />
        <Stat label="Active · 30d" value={formatNumber(activity.active30d)} icon={Users} accent="text-blue-400" />
        <Stat label="Never returned" value={formatNumber(activity.neverSeen)} icon={UserMinus} accent="text-amber-500"
              sub="signed up, never came back" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Buyers who paid" value={formatNumber(transacted.buyers)} icon={Wallet} accent="text-brand-green"
              sub="distinct, settled orders" />
        <Stat label="Sellers who sold" value={formatNumber(transacted.sellers)} icon={Wallet} accent="text-brand-green"
              sub="distinct, settled orders" />
        <Stat label="Joined · 12 months" value={formatNumber(totalJoined)} icon={Users} accent="text-purple-400" />
        <Stat label="Needs follow-up" value={formatNumber(dormant.length)} icon={UserMinus} accent="text-amber-500"
              sub="quiet for 30+ days" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--c-text)] mb-3">Signups by month</h2>
          {joinedByMonth.length === 0 ? (
            <p className="text-[var(--c-text-3)] text-sm">No signups recorded.</p>
          ) : (
            <div className="space-y-1.5">
              {joinedByMonth.map(m => (
                <div key={m.month} className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--c-text-3)] w-16 shrink-0 tabular-nums">{m.month}</span>
                  <div className="flex-1 h-4 bg-[var(--c-raised)] rounded-sm overflow-hidden">
                    <div className="h-full bg-brand-green/70 rounded-sm" style={{ width: `${(m.count / maxMonth) * 100}%` }} />
                  </div>
                  <span className="text-[var(--c-text)] font-semibold tabular-nums w-8 text-right">{m.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* The reason this page exists: a list of people to actually contact. */}
        <div className="lg:col-span-2 bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--c-text)] mb-1">Gone quiet</h2>
          <p className="text-[var(--c-text-3)] text-xs mb-3">
            Joined over a week ago and not seen for 30 days. These are the accounts worth reaching out to.
          </p>
          {dormant.length === 0 ? (
            <p className="text-[var(--c-text-3)] text-sm py-4">Nobody has gone quiet. Everyone who signed up is still active.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[520px]">
                <thead>
                  <tr className="text-[var(--c-text-3)] uppercase tracking-wider border-b border-[var(--c-border)]">
                    <th className="text-left font-semibold pb-2 pr-3">Customer</th>
                    <th className="text-left font-semibold pb-2 pr-3">ID</th>
                    <th className="text-left font-semibold pb-2 pr-3">Contact</th>
                    <th className="text-left font-semibold pb-2">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--c-border)]">
                  {dormant.map(u => (
                    <tr key={u._id}>
                      <td className="py-2 pr-3">
                        <p className="text-[var(--c-text)] font-medium truncate max-w-[150px]">{u.name}</p>
                        <p className="text-[var(--c-text-4)] text-[11px]">{u.role}</p>
                      </td>
                      <td className="py-2 pr-3 font-mono text-[var(--c-text-3)]">{u.customerId ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <p className="text-[var(--c-text-2)] truncate max-w-[170px]">{u.email}</p>
                        {u.phone && <p className="text-[var(--c-text-4)] text-[11px]">{u.phone}</p>}
                      </td>
                      <td className="py-2 text-[var(--c-text-3)] whitespace-nowrap">
                        {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
