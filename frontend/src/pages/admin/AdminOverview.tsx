import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, UserPlus, UserX, ShoppingBag, Wallet, Receipt,
  ShieldAlert, AlertOctagon, ShieldCheck, Package, ArrowRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface Overview {
  users: { total: number; new7d: number; suspended: number }
  orders: { total: number; byStatus: Record<string, number> }
  volume: {
    grossAllTime: number; feesAllTime: number; countAllTime: number
    gross30d: number; fees30d: number; count30d: number; currency: string
  }
  queues: { openDisputes: number; openFlags: number; pendingVerifications: number }
  catalogue: { activeProducts: number }
  signupSeries: { date: string; count: number }[]
}

/** Inline sparkline — a 14-point trend does not justify pulling in a chart library. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const max = Math.max(...points, 1)
  const w = 100, h = 28
  const step = w / (points.length - 1)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (p / max) * h).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Stat({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string
  icon: typeof Users; accent: string
}) {
  return (
    <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[var(--c-text-3)] text-xs font-medium uppercase tracking-wider">{label}</p>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className="text-2xl font-bold text-[var(--c-text)] tabular-nums">{value}</p>
      {sub && <p className="text-[var(--c-text-4)] text-xs mt-1">{sub}</p>}
    </div>
  )
}

/** A queue only earns attention when it has something in it. */
function QueueCard({ label, count, to, icon: Icon }: {
  label: string; count: number; to: string; icon: typeof ShieldAlert
}) {
  const idle = count === 0
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
        idle
          ? 'bg-[var(--c-card)] border-[var(--c-border)] hover:border-[var(--c-text-4)]'
          : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        idle ? 'bg-[var(--c-raised)] text-[var(--c-text-4)]' : 'bg-amber-500/20 text-amber-500'
      }`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[var(--c-text)] font-semibold text-sm">{label}</p>
        <p className={`text-xs ${idle ? 'text-[var(--c-text-4)]' : 'text-amber-600 dark:text-amber-400 font-medium'}`}>
          {idle ? 'Nothing waiting' : `${formatNumber(count)} awaiting review`}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-[var(--c-text-4)] shrink-0" />
    </Link>
  )
}

const STATUS_TONE: Record<string, string> = {
  COMPLETED: 'text-brand-green',
  DELIVERED: 'text-brand-green',
  CANCELLED: 'text-[var(--c-text-4)]',
  REFUNDED: 'text-[var(--c-text-4)]',
  DISPUTED: 'text-red-500',
  PENDING: 'text-amber-500',
}

export default function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Overview>>('/admin/overview')
      return res.data.data
    },
    // Operational numbers go stale quickly while staff are working a queue.
    refetchInterval: 60_000,
  })

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const { users, orders, volume, queues, catalogue, signupSeries } = data
  const avgOrder = volume.countAllTime ? volume.grossAllTime / volume.countAllTime : 0
  const statuses = Object.entries(orders.byStatus).sort((a, b) => b[1] - a[1])

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--c-text)]">Overview</h1>
        <p className="text-[var(--c-text-3)] text-sm mt-0.5">Platform health at a glance. Refreshes every minute.</p>
      </div>

      {/* Money first — it is what the panel exists to account for. */}
      <section>
        <h2 className="text-[var(--c-text-3)] text-xs font-semibold uppercase tracking-wider mb-3">Transactions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="Total volume" icon={Wallet} accent="text-brand-green"
            value={formatCurrency(volume.grossAllTime)}
            sub={`${formatNumber(volume.countAllTime)} settled orders`}
          />
          <Stat
            label="Volume (30d)" icon={Receipt} accent="text-brand-green"
            value={formatCurrency(volume.gross30d)}
            sub={`${formatNumber(volume.count30d)} orders`}
          />
          <Stat
            label="Platform fees" icon={Receipt} accent="text-gold"
            value={formatCurrency(volume.feesAllTime)}
            sub={`${formatCurrency(volume.fees30d)} in last 30d`}
          />
          <Stat
            label="Average order" icon={ShoppingBag} accent="text-purple-400"
            value={formatCurrency(avgOrder)}
            sub={`${formatNumber(orders.total)} orders all time`}
          />
        </div>
        <p className="text-[var(--c-text-4)] text-xs mt-2">
          Volume counts orders that reached payment or beyond — unpaid carts are excluded.
        </p>
      </section>

      {/* Anything needing a human decision. */}
      <section>
        <h2 className="text-[var(--c-text-3)] text-xs font-semibold uppercase tracking-wider mb-3">Needs attention</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <QueueCard label="Disputes" count={queues.openDisputes} to="/admin/disputes" icon={AlertOctagon} />
          <QueueCard label="Risk flags" count={queues.openFlags} to="/admin/compliance" icon={ShieldAlert} />
          <QueueCard label="Verifications" count={queues.pendingVerifications} to="/admin/verification" icon={ShieldCheck} />
        </div>
      </section>

      <section>
        <h2 className="text-[var(--c-text-3)] text-xs font-semibold uppercase tracking-wider mb-3">People &amp; catalogue</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Total users" value={formatNumber(users.total)} icon={Users} accent="text-blue-400" />
          <Stat label="New this week" value={formatNumber(users.new7d)} icon={UserPlus} accent="text-brand-green" />
          <Stat label="Suspended" value={formatNumber(users.suspended)} icon={UserX} accent="text-red-400" />
          <Stat label="Active listings" value={formatNumber(catalogue.activeProducts)} icon={Package} accent="text-orange-400" />
        </div>

        {signupSeries.length > 1 && (
          <div className="mt-3 bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4">
            <p className="text-[var(--c-text-3)] text-xs font-medium uppercase tracking-wider mb-2">Signups · last 14 days</p>
            <div className="text-brand-green">
              <Sparkline points={signupSeries.map(d => d.count)} />
            </div>
            <div className="flex justify-between text-[var(--c-text-4)] text-[10px] mt-1">
              <span>{signupSeries[0]?.date}</span>
              <span>{signupSeries[signupSeries.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[var(--c-text-3)] text-xs font-semibold uppercase tracking-wider">Orders by status</h2>
          <Link to="/admin/transactions" className="text-brand-green text-xs font-semibold hover:underline">
            View ledger
          </Link>
        </div>
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl divide-y divide-[var(--c-border)]">
          {statuses.length === 0 ? (
            <p className="p-4 text-[var(--c-text-3)] text-sm">No orders yet.</p>
          ) : statuses.map(([status, count], i) => (
            <motion.div
              key={status}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className={`text-sm font-medium ${STATUS_TONE[status] ?? 'text-[var(--c-text-2)]'}`}>
                {status.replace(/_/g, ' ')}
              </span>
              <span className="text-[var(--c-text)] text-sm font-semibold tabular-nums">{formatNumber(count)}</span>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
