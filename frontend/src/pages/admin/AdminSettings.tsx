import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, AlertTriangle, Check, Lock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface Settings {
  commissionPercent: number
  minPayoutAmount: number
  maintenanceMode: boolean
  maintenanceMessage: string
  allowRegistrations: boolean
  requireVerificationToSell: boolean
  autoApproveProducts: boolean
  supportEmail: string
  updatedAt?: string
}

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-40 ${checked ? 'bg-brand-green' : 'bg-[var(--c-border)]'}`}
    >
      <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

function Row({ label, help, danger, children }: {
  label: string; help: string; danger?: boolean; children: React.ReactNode
}) {
  return (
    <div className={`flex items-start justify-between gap-6 px-4 py-4 ${danger ? 'bg-red-500/[0.04]' : ''}`}>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${danger ? 'text-red-500' : 'text-[var(--c-text)]'}`}>{label}</p>
        <p className="text-[var(--c-text-3)] text-xs mt-0.5 leading-relaxed">{help}</p>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}

export default function AdminSettings() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)

  // Commission and maintenance mode affect every user, so the API restricts
  // writes to SUPER_ADMIN. Mirror that here rather than letting an ADMIN fill in
  // a form that will only fail on submit.
  const canEdit = user?.role === 'SUPER_ADMIN'

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Settings>>('/admin/settings')
      return res.data.data
    },
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = useMutation({
    mutationFn: async (payload: Settings) => {
      const res = await api.put<ApiResponse<Settings>>('/admin/settings', payload)
      return res.data.data
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin-settings'], updated)
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  if (isLoading || !form) {
    return <div className="p-6 space-y-3"><Skeleton className="h-8 w-40 rounded-xl" /><Skeleton className="h-96 rounded-2xl" /></div>
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm(f => f ? { ...f, [k]: v } : f)
  const dirty = JSON.stringify(form) !== JSON.stringify(data)
  const numberField = 'w-32 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-sm text-[var(--c-text)] text-right tabular-nums focus:outline-none focus:border-brand-green disabled:opacity-40'

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-[var(--c-text)]">Settings</h1>
        <p className="text-[var(--c-text-3)] text-sm mt-0.5">
          Platform-wide configuration. Every change is recorded in the audit trail.
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-3 bg-[var(--c-raised)] border border-[var(--c-border)] rounded-2xl p-4">
          <Lock className="h-4 w-4 text-[var(--c-text-4)] mt-0.5 shrink-0" />
          <p className="text-[var(--c-text-3)] text-sm">
            You can view these settings but not change them. Editing requires a super-admin account.
          </p>
        </div>
      )}

      {form.maintenanceMode && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-red-500 text-sm">
            Maintenance mode is on. Visitors see the message below instead of the marketplace.
          </p>
        </div>
      )}

      <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl divide-y divide-[var(--c-border)] overflow-hidden">
        <Row label="Commission" help="Percent of each order the platform keeps. Applies to orders created from now on — existing orders keep the fee they were priced with.">
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={50} step={0.5} disabled={!canEdit}
              value={form.commissionPercent}
              onChange={e => set('commissionPercent', Number(e.target.value))}
              className={numberField} />
            <span className="text-[var(--c-text-3)] text-sm">%</span>
          </div>
        </Row>

        <Row label="Minimum payout" help="Sellers cannot withdraw below this balance. Keeps payout fees from exceeding the amount being sent.">
          <div className="flex items-center gap-2">
            <input type="number" min={0} step={500} disabled={!canEdit}
              value={form.minPayoutAmount}
              onChange={e => set('minPayoutAmount', Number(e.target.value))}
              className={numberField} />
            <span className="text-[var(--c-text-3)] text-sm">TZS</span>
          </div>
        </Row>

        <Row label="Open registrations" help="When off, nobody new can sign up. Existing accounts keep working.">
          <Toggle checked={form.allowRegistrations} disabled={!canEdit} onChange={v => set('allowRegistrations', v)} />
        </Row>

        <Row label="Verification required to sell" help="Require an approved identity check before a seller can publish listings. Stricter, but slows new sellers down.">
          <Toggle checked={form.requireVerificationToSell} disabled={!canEdit} onChange={v => set('requireVerificationToSell', v)} />
        </Row>

        <Row label="Auto-approve listings" help="When off, new products wait for a moderator before appearing in the marketplace.">
          <Toggle checked={form.autoApproveProducts} disabled={!canEdit} onChange={v => set('autoApproveProducts', v)} />
        </Row>

        <Row label="Support email" help="Shown to users on error screens and in account emails.">
          <input type="email" disabled={!canEdit}
            value={form.supportEmail}
            onChange={e => set('supportEmail', e.target.value)}
            className="w-60 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green disabled:opacity-40" />
        </Row>

        <Row danger label="Maintenance mode" help="Takes the marketplace offline for everyone except admins. Use for migrations or incidents.">
          <Toggle checked={form.maintenanceMode} disabled={!canEdit} onChange={v => set('maintenanceMode', v)} />
        </Row>

        {form.maintenanceMode && (
          <div className="px-4 py-4 bg-red-500/[0.04]">
            <label className="block text-[var(--c-text-2)] text-sm font-semibold mb-2">Maintenance message</label>
            <textarea rows={2} disabled={!canEdit}
              value={form.maintenanceMessage}
              onChange={e => set('maintenanceMessage', e.target.value)}
              className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green disabled:opacity-40" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => form && save.mutate(form)}
          disabled={!canEdit || !dirty || save.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-emerald disabled:opacity-40 transition-colors"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>

        {dirty && !save.isPending && (
          <button onClick={() => data && setForm(data)} className="text-[var(--c-text-3)] text-sm hover:text-[var(--c-text)]">
            Discard
          </button>
        )}

        {saved && (
          <span className="flex items-center gap-1.5 text-brand-green text-sm font-medium">
            <Check className="h-4 w-4" /> Saved
          </span>
        )}

        {save.isError && (
          <span className="text-red-500 text-sm">
            {(save.error as any)?.response?.data?.message ?? 'Could not save.'}
          </span>
        )}
      </div>

      {data?.updatedAt && (
        <p className="text-[var(--c-text-4)] text-xs">
          Last changed {new Date(data.updatedAt).toLocaleString()}.
        </p>
      )}
    </div>
  )
}
