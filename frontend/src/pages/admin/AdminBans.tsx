import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, ShieldOff, RotateCcw, Phone, Fingerprint } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface BanRow {
  _id: string
  phone?: string
  nidaHash?: string
  reason: string
  bannedByEmail: string
  createdAt: string
  liftedAt?: string
}

export default function AdminBans() {
  const queryClient = useQueryClient()
  const [includeLifted, setIncludeLifted] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bans', includeLifted],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BanRow[]>>(`/admin/bans?includeLifted=${includeLifted}`)
      return res.data.data ?? []
    },
  })

  const lift = useMutation({
    mutationFn: (id: string) => api.put(`/admin/bans/${id}/lift`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bans'] })
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
    },
  })

  return (
    <div className="p-5 space-y-5 max-w-[1100px]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-[var(--c-text)]">Blocked identities</h1>
          <p className="text-[var(--c-text-3)] text-xs mt-0.5">
            Phone numbers and national IDs that cannot be used to register. Suspending an account only stops
            that login — a ban stops the person behind it coming back with a new email.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--c-text-2)] cursor-pointer">
          <input
            id="include-lifted"
            type="checkbox"
            checked={includeLifted}
            onChange={e => setIncludeLifted(e.target.checked)}
            className="accent-brand-green"
          />
          Show lifted
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : !data?.length ? (
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg text-center py-16 px-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-3">
            <ShieldOff className="h-5 w-5 text-[var(--c-text-4)]" />
          </div>
          <p className="text-[var(--c-text)] font-semibold">Nobody is blocked</p>
          <p className="text-[var(--c-text-3)] text-sm mt-1">
            Ban someone from the Users page — it suspends the account and blocks their phone and national ID.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg divide-y divide-[var(--c-border)]">
          {data.map(b => (
            <div key={b._id} className={`flex items-start gap-3 p-4 ${b.liftedAt ? 'opacity-55' : ''}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                b.liftedAt ? 'bg-[var(--c-raised)] text-[var(--c-text-4)]' : 'bg-red-500/10 text-red-500'
              }`}>
                <Ban className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {b.phone && (
                    <span className="inline-flex items-center gap-1 text-sm font-mono font-medium text-[var(--c-text)]">
                      <Phone className="h-3 w-3 text-[var(--c-text-4)]" />{b.phone}
                    </span>
                  )}
                  {b.nidaHash && (
                    // Only the hash exists; the number itself is never stored.
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--c-text-3)]" title="National ID (stored only as a hash)">
                      <Fingerprint className="h-3 w-3" />ID …{b.nidaHash.slice(-6)}
                    </span>
                  )}
                  {b.liftedAt && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--c-raised)] text-[var(--c-text-3)]">
                      Lifted
                    </span>
                  )}
                </div>
                <p className="text-[var(--c-text-2)] text-sm">{b.reason}</p>
                <p className="text-[var(--c-text-4)] text-[11px] mt-1">
                  by {b.bannedByEmail} · {new Date(b.createdAt).toLocaleString()}
                  {b.liftedAt && ` · lifted ${new Date(b.liftedAt).toLocaleDateString()}`}
                </p>
              </div>

              {!b.liftedAt && (
                <button
                  onClick={() => lift.mutate(b._id)}
                  disabled={lift.isPending}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--c-raised)] text-[var(--c-text-2)] text-xs font-medium hover:text-[var(--c-text)] disabled:opacity-40 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Lift
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[var(--c-text-4)] text-[11px]">
        Lifting a ban also un-suspends the account it came from. Entries are kept rather than deleted, so the
        record of who was blocked and who reversed it survives.
      </p>
    </div>
  )
}
