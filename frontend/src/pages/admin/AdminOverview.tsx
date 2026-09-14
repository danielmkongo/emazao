import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Users, UserPlus, UserX, ShoppingBag, Wallet, Receipt, Radio,
  ShieldAlert, AlertOctagon, ShieldCheck, Package, ArrowRight,
  MessageSquare, Video, Scale,
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
  revenueSeries: { date: string; gross: number; fees: number; count: number }[]
  usersByRole: Record<string, number>
  topSellers: { _id: string; gross: number; orders: number; name?: string; username?: string }[]
  liveNow: { title: string; viewerCount: number; broadcaster: string; username?: string; startedAt: string }[]
  pulse24h: { newUsers: number; orders: number; reels: number; messages: number }
  verificationFunnel: Record<string, number>
  disputeRate: number
}

/**
 * Expand a sparse series into one entry per day.
 *
 * The aggregation only returns days that had activity, so a fortnight with
 * three trading days came back as three points — which a chart labelled
 * "14 days" then drew as three slabs spanning the full width, misrepresenting
 * both the shape and the gaps.
 */
function fillDays(series: { date: string; value: number }[], days: number) {
  const byDate = new Map(series.map(d => [d.date, d.value]))
  const out: { date: string; value: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, value: byDate.get(key) ?? 0 })
  }
  return out
}

/** Daily bars. A 14-point series does not justify a charting library. */
function BarSeries({ points, format }: { points: { date: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(...points.map(p => p.value), 1)
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0])
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-end gap-[3px] flex-1 min-h-[7rem]">
        {points.map(p => (
          <div key={p.date} className="flex-1 min-w-0 group relative flex flex-col justify-end h-full">
            <div
              className={`w-full rounded-sm transition-colors ${p.value > 0 ? 'bg-brand-green/70 group-hover:bg-brand-green' : 'bg-[var(--c-border)]'}`}
              style={{ height: `${Math.max((p.value / max) * 100, p.value > 0 ? 6 : 2)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 whitespace-nowrap rounded bg-[var(--c-text)] px-2 py-1 text-[10px] font-medium text-[var(--c-bg)]">
              {p.date.slice(5)} · {format(p.value)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-[var(--c-text-4)] tabular-nums shrink-0">
        <span>{points[0]?.date.slice(5)}</span>
        <span>peak {format(peak?.value ?? 0)}</span>
        <span>{points[points.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
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

function Queue({ label, count, to, icon: Icon }: {
  label: string; count: number; to: string; icon: typeof ShieldAlert
}) {
  const idle = count === 0
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-3.5 rounded-lg border transition-colors ${
        idle ? 'bg-[var(--c-card)] border-[var(--c-border)] hover:border-[var(--c-text-4)]'
             : 'bg-amber-500/[0.07] border-amber-500/30 hover:bg-amber-500/[0.12]'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${idle ? 'text-[var(--c-text-4)]' : 'text-amber-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[var(--c-text)] text-sm font-semibold leading-tight">{label}</p>
        <p className={`text-[11px] ${idle ? 'text-[var(--c-text-4)]' : 'text-amber-600 dark:text-amber-400 font-medium'}`}>
          {idle ? 'Clear' : `${formatNumber(count)} waiting`}
        </p>
      </div>
      {!idle && <span className="text-xl font-bold text-amber-500 tabular-nums">{count}</span>}
      <ArrowRight className="h-3.5 w-3.5 text-[var(--c-text-4)] shrink-0" />
    </Link>
  )
}

const STATUS_TONE: Record<string, string> = {
  COMPLETED: 'bg-brand-green', DELIVERED: 'bg-brand-green',
  PAYMENT_CONFIRMED: 'bg-blue-500', PROCESSING: 'bg-blue-500', SHIPPED: 'bg-purple-500',
  PENDING: 'bg-amber-500', DISPUTED: 'bg-red-500',
  CANCELLED: 'bg-[var(--c-text-4)]', REFUNDED: 'bg-[var(--c-text-4)]',
}

const ROLE_LABEL: Record<string, string> = {
  FARMER: 'Farmers', BUYER: 'Buyers', BUSINESS_BUYER: 'Business buyers',
  LOGISTICS: 'Logistics', ADMIN: 'Admins', SUPER_ADMIN: 'Super admins',
}

export default function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Overview>>('/admin/overview')
      return res.data.data
    },
    refetchInterval: 60_000,
  })

  if (isLoading || !data) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-7 w-40 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-52 rounded-lg" />
      </div>
    )
  }

  const { users, orders, volume, queues, catalogue, revenueSeries, usersByRole,
          topSellers, liveNow, pulse24h, verificationFunnel, disputeRate } = data

  const avgOrder = volume.countAllTime ? volume.grossAllTime / volume.countAllTime : 0
  const takeRate = volume.grossAllTime ? (volume.feesAllTime / volume.grossAllTime) * 100 : 0
  const statuses = Object.entries(orders.byStatus).sort((a, b) => b[1] - a[1])
  const statusTotal = statuses.reduce((s, [, n]) => s + n, 0) || 1
  const roles = Object.entries(usersByRole).sort((a, b) => b[1] - a[1])

  return (
    <div className="p-5 space-y-6 max-w-[1400px]">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-[var(--c-text)]">Overview</h1>
          <p className="text-[var(--c-text-3)] text-xs mt-0.5">Live platform state · refreshes every minute</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--c-text-3)] tabular-nums">
          <span><MessageSquare className="h-3 w-3 inline mr-1" />{formatNumber(pulse24h.messages)} messages/24h</span>
          <span><Video className="h-3 w-3 inline mr-1" />{formatNumber(pulse24h.reels)} reels/24h</span>
        </div>
      </div>

      {/* Money first. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Volume · all time" value={formatCurrency(volume.grossAllTime)} icon={Wallet} accent="text-brand-green"
              sub={`${formatNumber(volume.countAllTime)} settled orders`} />
        <Stat label="Volume · 30d" value={formatCurrency(volume.gross30d)} icon={Receipt} accent="text-brand-green"
              sub={`${formatNumber(volume.count30d)} orders`} />
        <Stat label="Platform fees" value={formatCurrency(volume.feesAllTime)} icon={Receipt} accent="text-gold"
              sub={`${takeRate.toFixed(1)}% effective take rate`} />
        <Stat label="Average order" value={formatCurrency(avgOrder)} icon={ShoppingBag} accent="text-purple-400"
              sub={`${formatNumber(orders.total)} orders all time`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4 flex flex-col">
          <div className="flex items-baseline justify-between mb-3 shrink-0">
            <h2 className="text-sm font-semibold text-[var(--c-text)]">Daily volume · 14 days</h2>
            <Link to="/admin/transactions" className="text-brand-green text-xs font-medium hover:underline">Ledger →</Link>
          </div>
          <BarSeries
            points={fillDays(revenueSeries.map(d => ({ date: d.date, value: d.gross })), 14)}
            format={formatCurrency}
          />
        </div>

        {/* Queues */}
        <div className="space-y-2.5">
          <h2 className="text-sm font-semibold text-[var(--c-text)]">Needs a decision</h2>
          <Queue label="Disputes" count={queues.openDisputes} to="/admin/disputes" icon={AlertOctagon} />
          <Queue label="Risk flags" count={queues.openFlags} to="/admin/compliance" icon={ShieldAlert} />
          <Queue label="Verification" count={queues.pendingVerifications} to="/admin/verification" icon={ShieldCheck} />
        </div>
      </div>

      {/* Live now — only when something is actually broadcasting. */}
      {liveNow.length > 0 && (
        <div className="bg-[var(--c-card)] border border-red-500/30 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--c-text)] flex items-center gap-2 mb-3">
            <Radio className="h-4 w-4 text-red-500" /> Live now
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500">{liveNow.length}</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {liveNow.map((l, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-md bg-[var(--c-raised)]">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--c-text)] text-xs font-medium truncate">{l.broadcaster}</p>
                  <p className="text-[var(--c-text-4)] text-[11px] truncate">{l.title || 'Untitled stream'}</p>
                </div>
                <span className="text-[var(--c-text-2)] text-xs font-semibold tabular-nums shrink-0">{formatNumber(l.viewerCount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* People, catalogue, trust */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Total users" value={formatNumber(users.total)} icon={Users} accent="text-blue-400" />
        <Stat label="New · 7d" value={formatNumber(users.new7d)} icon={UserPlus} accent="text-brand-green"
              sub={`${formatNumber(pulse24h.newUsers)} in last 24h`} />
        <Stat label="Suspended" value={formatNumber(users.suspended)} icon={UserX} accent="text-red-400" />
        <Stat label="Active listings" value={formatNumber(catalogue.activeProducts)} icon={Package} accent="text-orange-400" />
        <Stat label="Dispute rate" value={`${(disputeRate * 100).toFixed(2)}%`} icon={Scale}
              accent={disputeRate > 0.02 ? 'text-red-400' : 'text-brand-green'}
              sub="of all orders" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Order status distribution as a single stacked bar — proportions read
            faster than a column of numbers. */}
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--c-text)] mb-3">Orders by status</h2>
          {statuses.length === 0 ? (
            <p className="text-[var(--c-text-3)] text-sm">No orders yet.</p>
          ) : (
            <>
              <div className="flex h-2 rounded-full overflow-hidden mb-3">
                {statuses.map(([s, n]) => (
                  <div key={s} className={STATUS_TONE[s] ?? 'bg-[var(--c-text-4)]'} style={{ width: `${(n / statusTotal) * 100}%` }} title={`${s}: ${n}`} />
                ))}
              </div>
              <div className="space-y-1.5">
                {statuses.map(([s, n]) => (
                  <div key={s} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-sm shrink-0 ${STATUS_TONE[s] ?? 'bg-[var(--c-text-4)]'}`} />
                    <span className="text-[var(--c-text-2)] flex-1 truncate">{s.replace(/_/g, ' ')}</span>
                    <span className="text-[var(--c-text)] font-semibold tabular-nums">{formatNumber(n)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top sellers */}
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--c-text)] mb-3">Top sellers by volume</h2>
          {topSellers.length === 0 ? (
            <p className="text-[var(--c-text-3)] text-sm">No settled orders yet.</p>
          ) : (
            <div className="space-y-2">
              {topSellers.map((s, i) => (
                <div key={s._id} className="flex items-center gap-2.5 text-xs">
                  <span className="text-[var(--c-text-4)] font-semibold w-3 tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--c-text)] font-medium truncate">{s.name ?? 'Unknown'}</p>
                    <p className="text-[var(--c-text-4)] text-[11px]">{formatNumber(s.orders)} orders</p>
                  </div>
                  <span className="text-brand-green font-semibold tabular-nums shrink-0">{formatCurrency(s.gross)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Composition + verification funnel */}
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--c-text)] mb-2.5">Who is on the platform</h2>
            <div className="space-y-1.5">
              {roles.map(([role, n]) => (
                <div key={role} className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--c-text-2)] flex-1 truncate">{ROLE_LABEL[role] ?? role}</span>
                  <span className="text-[var(--c-text)] font-semibold tabular-nums">{formatNumber(n)}</span>
                </div>
              ))}
            </div>
          </div>
          {Object.keys(verificationFunnel).length > 0 && (
            <div className="pt-3 border-t border-[var(--c-border)]">
              <h2 className="text-sm font-semibold text-[var(--c-text)] mb-2.5">Verification</h2>
              <div className="space-y-1.5">
                {Object.entries(verificationFunnel).map(([status, n]) => (
                  <div key={status} className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--c-text-2)] flex-1 truncate">{status.replace(/_/g, ' ')}</span>
                    <span className="text-[var(--c-text)] font-semibold tabular-nums">{formatNumber(n)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-[var(--c-text-4)] text-[11px]">
        Volume counts orders that reached payment or beyond — unpaid carts are excluded.
      </p>
    </div>
  )
}
