import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShieldCheck, Upload, CheckCircle2, Clock, XCircle, IdCard, AlertTriangle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LivenessCapture } from '@/components/verification/LivenessCapture'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface TierInfo {
  tier: number
  label: string
  payoutCeiling: number | null
  requirements: string[]
}

interface VerificationState {
  tier: number
  status: 'UNVERIFIED' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED'
  label: string
  lifetimePayoutValue: number
  payoutCeiling: number
  nidaLast4?: string
  payoutAccountName?: string
  documents: { kind: string; uploadedAt: string }[]
  rejectionReason?: string
  tiers: TierInfo[]
  biometricAvailable: boolean
}

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  VERIFIED: { icon: CheckCircle2, className: 'text-brand-green', label: 'Verified' },
  PENDING_REVIEW: { icon: Clock, className: 'text-amber-500', label: 'Under review' },
  REJECTED: { icon: XCircle, className: 'text-red-500', label: 'Needs attention' },
  SUSPENDED: { icon: Lock, className: 'text-red-500', label: 'Suspended' },
  UNVERIFIED: { icon: ShieldCheck, className: 'text-[var(--c-text-4)]', label: 'Not verified' },
}

export default function Verification() {
  const queryClient = useQueryClient()
  const idInputRef = useRef<HTMLInputElement>(null)

  const [nidaNumber, setNidaNumber] = useState('')
  const [declaredName, setDeclaredName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['verification'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<VerificationState>>('/verification/me')
      return res.data.data!
    },
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['verification'] })

  const nidaMutation = useMutation({
    mutationFn: () => api.post('/verification/nida', { nidaNumber, declaredName }),
    onSuccess: () => { setFormError(null); refresh() },
    onError: (err: any) => setFormError(err?.response?.data?.message ?? 'Could not save your ID number'),
  })

  const docMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', 'NATIONAL_ID_FRONT')
      return api.post('/verification/document', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { setFormError(null); refresh() },
    onError: (err: any) => setFormError(err?.response?.data?.message ?? 'Could not upload the document'),
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post('/verification/submit'),
    onSuccess: () => { setFormError(null); refresh() },
    onError: (err: any) => setFormError(err?.response?.data?.message ?? 'Could not submit for review'),
  })

  if (isLoading || !data) {
    return <div className="p-6 text-[var(--c-text-3)]">Loading…</div>
  }

  const status = STATUS_STYLES[data.status] ?? STATUS_STYLES.UNVERIFIED
  const StatusIcon = status.icon
  const hasNida = !!data.nidaLast4
  const hasIdDoc = data.documents.some(d => d.kind === 'NATIONAL_ID_FRONT')
  const hasSelfie = data.documents.some(d => d.kind === 'SELFIE')
  const readyToSubmit = hasNida && hasIdDoc && hasSelfie && data.status !== 'PENDING_REVIEW'
  const used = data.payoutCeiling > 0 ? Math.min(100, (data.lifetimePayoutValue / data.payoutCeiling) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--c-text)]">Account verification</h1>
        <p className="text-[var(--c-text-3)] text-sm mt-1">
          You can sell straight away. Verification is only needed to withdraw money, and unlocks
          higher limits as you grow.
        </p>
      </div>

      {/* Current standing */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${status.className}`} />
            <span className="font-semibold text-[var(--c-text)]">{data.label}</span>
          </div>
          <span className={`text-sm ${status.className}`}>{status.label}</span>
        </div>

        {data.payoutCeiling > 0 && Number.isFinite(data.payoutCeiling) && (
          <>
            <div className="h-2 bg-[var(--c-input)] rounded-full overflow-hidden">
              <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${used}%` }} />
            </div>
            <p className="text-xs text-[var(--c-text-3)] mt-2">
              {data.lifetimePayoutValue.toLocaleString()} of {data.payoutCeiling.toLocaleString()} withdrawn
              at this level
            </p>
          </>
        )}

        {data.payoutAccountName && (
          <p className="text-xs text-[var(--c-text-3)] mt-3 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" />
            Mobile money wallet confirmed as <span className="font-medium">{data.payoutAccountName}</span>
          </p>
        )}
      </motion.div>

      {data.status === 'REJECTED' && data.rejectionReason && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">We couldn't verify your account</p>
            <p className="mt-0.5">{data.rejectionReason}</p>
          </div>
        </div>
      )}

      {data.status === 'PENDING_REVIEW' && (
        <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <Clock className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Your documents are with our team. We usually review within one business day.</span>
        </div>
      )}

      {/* Step 1 — NIDA */}
      <section className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <IdCard className="h-4 w-4 text-[var(--c-text-3)]" />
          <h2 className="font-semibold text-[var(--c-text)]">1. National ID number</h2>
          {hasNida && <CheckCircle2 className="h-4 w-4 text-brand-green" />}
        </div>

        {hasNida ? (
          <p className="text-sm text-[var(--c-text-3)]">
            Saved — ending <span className="font-mono">••••{data.nidaLast4}</span>
          </p>
        ) : (
          <>
            <input
              value={declaredName}
              onChange={e => setDeclaredName(e.target.value)}
              placeholder="Full name, exactly as printed on your ID"
              className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green"
            />
            <input
              value={nidaNumber}
              onChange={e => setNidaNumber(e.target.value)}
              inputMode="numeric"
              placeholder="NIDA number (20 digits)"
              className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green font-mono"
            />
            <Button
              className="w-full"
              onClick={() => nidaMutation.mutate()}
              disabled={!nidaNumber.trim() || !declaredName.trim() || nidaMutation.isPending}
              loading={nidaMutation.isPending}
            >
              Save ID number
            </Button>
            <p className="text-xs text-[var(--c-text-4)]">
              We store this encrypted and never display it in full.
            </p>
          </>
        )}
      </section>

      {/* Step 2 — ID photo */}
      <section className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-[var(--c-text-3)]" />
          <h2 className="font-semibold text-[var(--c-text)]">2. Photo of your ID</h2>
          {hasIdDoc && <CheckCircle2 className="h-4 w-4 text-brand-green" />}
        </div>
        <p className="text-sm text-[var(--c-text-3)]">
          Photograph the front of your NIDA card. Make sure all four corners are visible and the text
          is readable.
        </p>
        <input
          ref={idInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) docMutation.mutate(f) }}
        />
        <Button
          variant={hasIdDoc ? 'outline' : 'primary'}
          className="w-full"
          onClick={() => idInputRef.current?.click()}
          disabled={docMutation.isPending}
          loading={docMutation.isPending}
        >
          {hasIdDoc ? 'Replace photo' : 'Upload ID photo'}
        </Button>
      </section>

      {/* Step 3 — liveness */}
      <section className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[var(--c-text-3)]" />
          <h2 className="font-semibold text-[var(--c-text)]">3. Camera check</h2>
          {hasSelfie && <CheckCircle2 className="h-4 w-4 text-brand-green" />}
        </div>

        {!data.biometricAvailable ? (
          <p className="text-sm text-[var(--c-text-3)]">
            Camera checks are temporarily unavailable. You can submit the steps above and our team
            will review your account manually.
          </p>
        ) : hasSelfie ? (
          <p className="text-sm text-[var(--c-text-3)]">Completed.</p>
        ) : (
          <LivenessCapture onComplete={refresh} />
        )}
      </section>

      {formError && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      <Button
        className="w-full"
        onClick={() => submitMutation.mutate()}
        disabled={!readyToSubmit || submitMutation.isPending}
        loading={submitMutation.isPending}
      >
        Submit for verification
      </Button>

      {/* Tier reference */}
      <section className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5">
        <h2 className="font-semibold text-[var(--c-text)] mb-3">Withdrawal limits</h2>
        <div className="space-y-3">
          {data.tiers.map(t => (
            <div key={t.tier} className={`flex items-start justify-between gap-4 ${t.tier === data.tier ? '' : 'opacity-60'}`}>
              <div>
                <p className="text-sm font-medium text-[var(--c-text)]">
                  {t.label}
                  {t.tier === data.tier && <span className="ml-2 text-xs text-brand-green">current</span>}
                </p>
                <p className="text-xs text-[var(--c-text-3)] mt-0.5">{t.requirements.join(' · ')}</p>
              </div>
              <span className="text-sm text-[var(--c-text-3)] whitespace-nowrap">
                {t.payoutCeiling === null ? 'No limit' : t.payoutCeiling.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
