import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  ScrollText, ChevronLeft, ChevronRight, Search,
  ShieldCheck, ShieldOff, KeyRound, Settings2, Gavel, Dot,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface AuditRow {
  _id: string
  actorEmail: string
  actorRole: string
  action: string
  targetType: string
  targetId?: string
  targetLabel?: string
  summary: string
  ip?: string
  createdAt: string
}

interface AuditPage {
  rows: AuditRow[]
  page: number
  pages: number
  total: number
  actions: string[]
}

const ICONS: Record<string, typeof ShieldCheck> = {
  USER_VERIFY: ShieldCheck,
  USER_SUSPEND: ShieldOff,
  USER_UNSUSPEND: ShieldCheck,
  PASSWORD_RESET_ISSUED: KeyRound,
  SETTINGS_UPDATE: Settings2,
  DISPUTE_RESOLVE: Gavel,
}

// Actions that remove access or move money read differently from routine ones,
// so they are tinted rather than left to blend into the list.
const TONE: Record<string, string> = {
  USER_SUSPEND: 'bg-red-500/10 text-red-500',
  DISPUTE_RESOLVE: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PASSWORD_RESET_ISSUED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  SETTINGS_UPDATE: 'bg-purple-500/10 text-purple-500',
}

export default function AdminAudit() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('ALL')
  const [actor, setActor] = useState('')
  const [submittedActor, setSubmittedActor] = useState('')

  const params = new URLSearchParams({ page: String(page), limit: '50', action })
  if (submittedActor) params.set('actor', submittedActor)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-audit', params.toString()],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AuditPage>>(`/admin/audit?${params}`)
      return res.data.data
    },
    placeholderData: keepPreviousData,
  })

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--c-text)]">Audit trail</h1>
        <p className="text-[var(--c-text-3)] text-sm mt-0.5">
          Every privileged action, who took it and when. Append-only — entries cannot be edited or deleted, including by admins.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[var(--c-text-3)] text-xs mb-1.5">Admin</label>
          <div className="flex items-center gap-2 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 focus-within:border-brand-green">
            <Search className="h-4 w-4 text-[var(--c-text-4)] shrink-0" />
            <input
              value={actor}
              onChange={e => setActor(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setSubmittedActor(actor); setPage(1) } }}
              placeholder="admin@emazao.com"
              className="flex-1 bg-transparent py-2 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-[var(--c-text-3)] text-xs mb-1.5">Action</label>
          <select
            value={action}
            onChange={e => { setAction(e.target.value); setPage(1) }}
            className="bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green"
          >
            <option value="ALL">All actions</option>
            {(data?.actions ?? []).map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        {(action !== 'ALL' || submittedActor) && (
          <button
            onClick={() => { setAction('ALL'); setActor(''); setSubmittedActor(''); setPage(1) }}
            className="text-[var(--c-text-3)] text-sm hover:text-[var(--c-text)] py-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(10)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : !data?.rows.length ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-3">
              <ScrollText className="h-6 w-6 text-[var(--c-text-4)]" />
            </div>
            <p className="text-[var(--c-text)] font-semibold">Nothing recorded yet</p>
            <p className="text-[var(--c-text-3)] text-sm mt-1">
              Entries appear here as admins verify users, resolve disputes or change settings.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--c-border)]">
            {data.rows.map(row => {
              const Icon = ICONS[row.action] ?? Dot
              return (
                <div key={row._id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TONE[row.action] ?? 'bg-[var(--c-raised)] text-[var(--c-text-3)]'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--c-text)] text-sm">{row.summary}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1 text-[var(--c-text-4)] text-xs">
                      <span className="font-medium text-[var(--c-text-3)]">{row.actorEmail}</span>
                      <span>·</span>
                      <span>{row.actorRole}</span>
                      <span>·</span>
                      <span>{new Date(row.createdAt).toLocaleString()}</span>
                      {row.ip && <><span>·</span><span className="tabular-nums">{row.ip}</span></>}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--c-text-4)] uppercase tracking-wider shrink-0 hidden sm:block">
                    {row.targetType}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {(data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[var(--c-text-3)] text-sm">
            {formatNumber(data!.total)} entries · page {data!.page} of {data!.pages}
            {isFetching && <span className="text-[var(--c-text-4)]"> · updating…</span>}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="w-9 h-9 rounded-xl bg-[var(--c-raised)] flex items-center justify-center text-[var(--c-text-2)] disabled:opacity-30 hover:text-[var(--c-text)] transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(data!.pages, p + 1))} disabled={page >= (data?.pages ?? 1)}
              className="w-9 h-9 rounded-xl bg-[var(--c-raised)] flex items-center justify-center text-[var(--c-text-2)] disabled:opacity-30 hover:text-[var(--c-text)] transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
