import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShieldAlert, FileCheck, ExternalLink, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface RiskFlag {
  _id: string
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  detail: string
  blockedPayout: boolean
  createdAt: string
  evidence?: Record<string, unknown>
  userId?: { _id: string; name: string; username: string; email: string }
  relatedUserId?: { _id: string; name: string; username: string }
  orderId?: { orderNumber: string; total: number; currency: string; status: string }
}

interface PendingProfile {
  _id: string
  tier: number
  status: string
  declaredName?: string
  nidaLast4?: string
  payoutAccountName?: string
  payoutNameMatchScore?: number
  lifetimePayoutValue: number
  updatedAt: string
  userId?: { _id: string; name: string; username: string; email: string; phone?: string }
}

const SEVERITY: Record<string, string> = {
  HIGH: 'bg-red-500/15 text-red-500 border-red-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  LOW: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
}

const TYPE_LABEL: Record<string, string> = {
  SELF_DEALING: 'Self-dealing',
  STRUCTURING: 'Structuring',
  VELOCITY_SPIKE: 'Velocity spike',
  PAYOUT_NAME_MISMATCH: 'Payout name mismatch',
  DUPLICATE_IDENTITY: 'Duplicate identity',
  CIRCULAR_TRADING: 'Circular trading',
  PRICE_ANOMALY: 'Price anomaly',
}

export default function Compliance() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'flags' | 'kyc'>('flags')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [docsFor, setDocsFor] = useState<string | null>(null)

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ['compliance-flags'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RiskFlag[]>>('/admin/compliance/flags?status=OPEN')
      return res.data.data ?? []
    },
    enabled: tab === 'flags',
  })

  const { data: profiles, isLoading: kycLoading } = useQuery({
    queryKey: ['compliance-kyc'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PendingProfile[]>>('/admin/compliance/verifications')
      return res.data.data ?? []
    },
    enabled: tab === 'kyc',
  })

  const { data: docs, isFetching: docsLoading } = useQuery({
    queryKey: ['compliance-docs', docsFor],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ kind: string; url: string; faceScore?: number }[]>>(
        `/admin/compliance/verifications/${docsFor}/documents`,
      )
      return res.data.data ?? []
    },
    enabled: !!docsFor,
  })

  const reviewFlag = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'CLEARED' | 'CONFIRMED'; note?: string }) =>
      api.put(`/admin/compliance/flags/${id}`, { decision, note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compliance-flags'] }),
  })

  const decideKyc = useMutation({
    mutationFn: ({ userId, decision, tier, reason }: { userId: string; decision: 'APPROVE' | 'REJECT'; tier?: number; reason?: string }) =>
      api.put(`/admin/compliance/verifications/${userId}`, { decision, tier, reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compliance-kyc'] }),
  })

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-[var(--c-text)] mb-1">Compliance</h1>
      <p className="text-sm text-[var(--c-text-3)] mb-5">
        Money-laundering signals and identity reviews. Confirming a flag suspends the account and
        keeps funds frozen.
      </p>

      <div className="flex gap-2 mb-5">
        {(['flags', 'kyc'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              tab === t
                ? 'bg-brand-green/15 border-brand-green text-brand-green'
                : 'border-[var(--c-border)] text-[var(--c-text-3)] hover:border-brand-green/40'
            }`}
          >
            {t === 'flags' ? 'Risk flags' : 'ID reviews'}
          </button>
        ))}
      </div>

      {tab === 'flags' && (
        <div className="space-y-3">
          {flagsLoading ? (
            <p className="text-[var(--c-text-3)]">Loading…</p>
          ) : !flags?.length ? (
            <div className="text-center py-16">
              <ShieldAlert className="h-12 w-12 text-brand-green mx-auto mb-3" />
              <p className="text-[var(--c-text-3)]">No open flags</p>
            </div>
          ) : (
            flags.map(flag => (
              <motion.div key={flag._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-lg border ${SEVERITY[flag.severity]}`}>
                      {flag.severity}
                    </span>
                    <span className="font-semibold text-[var(--c-text)]">
                      {TYPE_LABEL[flag.type] ?? flag.type}
                    </span>
                    {flag.blockedPayout && (
                      <Badge variant="urgent" className="text-xs">Payouts frozen</Badge>
                    )}
                  </div>
                  <span className="text-xs text-[var(--c-text-4)] whitespace-nowrap">{timeAgo(flag.createdAt)}</span>
                </div>

                <p className="text-sm text-[var(--c-text-2)] mb-2">{flag.detail}</p>

                <div className="text-xs text-[var(--c-text-3)] space-y-0.5 mb-3">
                  {flag.userId && <p>Account: {flag.userId.name} (@{flag.userId.username})</p>}
                  {flag.relatedUserId && <p>Counterparty: {flag.relatedUserId.name} (@{flag.relatedUserId.username})</p>}
                  {flag.orderId && (
                    <p>Order {flag.orderId.orderNumber} — {flag.orderId.currency} {flag.orderId.total?.toLocaleString()}</p>
                  )}
                </div>

                <input
                  value={notes[flag._id] ?? ''}
                  onChange={e => setNotes(n => ({ ...n, [flag._id]: e.target.value }))}
                  placeholder="Review note (recorded against this decision)"
                  className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green mb-2"
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline" className="flex-1"
                    onClick={() => reviewFlag.mutate({ id: flag._id, decision: 'CLEARED', note: notes[flag._id] })}
                    disabled={reviewFlag.isPending}
                  >
                    <Check className="h-4 w-4" /> Clear
                  </Button>
                  <Button
                    variant="destructive" className="flex-1"
                    onClick={() => reviewFlag.mutate({ id: flag._id, decision: 'CONFIRMED', note: notes[flag._id] })}
                    disabled={reviewFlag.isPending}
                  >
                    <X className="h-4 w-4" /> Confirm & suspend
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === 'kyc' && (
        <div className="space-y-3">
          {kycLoading ? (
            <p className="text-[var(--c-text-3)]">Loading…</p>
          ) : !profiles?.length ? (
            <div className="text-center py-16">
              <FileCheck className="h-12 w-12 text-brand-green mx-auto mb-3" />
              <p className="text-[var(--c-text-3)]">Nothing awaiting review</p>
            </div>
          ) : (
            profiles.map(p => {
              const uid = p.userId?._id ?? ''
              const mismatch = (p.payoutNameMatchScore ?? 1) < 0.5
              return (
                <motion.div key={p._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-[var(--c-text)]">{p.userId?.name}</p>
                      <p className="text-xs text-[var(--c-text-3)]">
                        @{p.userId?.username} · {p.userId?.email}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--c-text-4)]">{timeAgo(p.updatedAt)}</span>
                  </div>

                  <dl className="text-xs text-[var(--c-text-3)] space-y-0.5 mb-3">
                    <div>Declared name: <span className="text-[var(--c-text-2)]">{p.declaredName ?? '—'}</span></div>
                    <div>NIDA: <span className="font-mono">••••{p.nidaLast4 ?? '????'}</span></div>
                    <div className={mismatch ? 'text-amber-600' : ''}>
                      Wallet name: {p.payoutAccountName ?? 'not yet confirmed'}
                      {p.payoutNameMatchScore !== undefined && ` (match ${(p.payoutNameMatchScore * 100).toFixed(0)}%)`}
                    </div>
                    <div>Withdrawn to date: {p.lifetimePayoutValue.toLocaleString()}</div>
                  </dl>

                  <Button variant="outline" className="w-full mb-2" onClick={() => setDocsFor(docsFor === uid ? null : uid)}>
                    <ExternalLink className="h-4 w-4" />
                    {docsFor === uid ? 'Hide documents' : 'View documents'}
                  </Button>

                  {docsFor === uid && (
                    <div className="mb-3">
                      {docsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-[var(--c-text-3)] py-3">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {docs?.map(d => (
                            <a key={d.kind} href={d.url} target="_blank" rel="noreferrer"
                              className="block rounded-xl overflow-hidden border border-[var(--c-border)]">
                              <img src={d.url} alt={d.kind} className="w-full h-32 object-cover" />
                              <p className="text-xs text-[var(--c-text-3)] p-1.5 text-center">
                                {d.kind.replace(/_/g, ' ').toLowerCase()}
                              </p>
                            </a>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-[var(--c-text-4)] mt-2">
                        Links expire in 5 minutes. This view is recorded in the audit log.
                      </p>
                    </div>
                  )}

                  <input
                    value={notes[p._id] ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [p._id]: e.target.value }))}
                    placeholder="Reason (required to reject)"
                    className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green mb-2"
                  />

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => decideKyc.mutate({ userId: uid, decision: 'APPROVE', tier: 2 })}
                      disabled={decideKyc.isPending}
                    >
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="destructive" className="flex-1"
                      onClick={() => decideKyc.mutate({ userId: uid, decision: 'REJECT', reason: notes[p._id] })}
                      disabled={decideKyc.isPending || !notes[p._id]?.trim()}
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
