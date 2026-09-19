import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, X, Loader2 } from 'lucide-react'
import api from '@/lib/api'

const REASONS = [
  { key: 'NOT_RECEIVED', label: 'I did not receive it' },
  { key: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { key: 'DAMAGED', label: 'Arrived damaged or spoiled' },
  { key: 'WRONG_QUANTITY', label: 'Wrong quantity' },
  { key: 'OTHER', label: 'Something else' },
] as const

/**
 * Report a problem with a paid order. Puts the payment on hold (so it is not
 * released to the seller) and opens a case for eMazao to review, which ends in
 * either the seller being paid or the buyer being refunded to the wallet that
 * paid.
 */
export function ReportProblemSheet({ orderId, onClose, onDone }: { orderId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<string>('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSending(true); setError(null)
    try {
      await api.post(`/orders/${orderId}/dispute`, { reason, description: description.trim() })
      onDone()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not send your report. Please try again.')
    } finally { setSending(false) }
  }

  const ready = !!reason && description.trim().length >= 10

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Report a problem">
      <motion.div className="absolute inset-0 bg-[var(--c-overlay)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        className="relative w-full sm:max-w-md bg-[var(--c-card)] rounded-t-3xl sm:rounded-3xl border border-[var(--c-border)] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-[var(--c-text)] flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Report a problem</h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--c-raised)]"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-[var(--c-text-3)] mb-4">Your payment stays on hold while eMazao reviews this. You will hear back, and if the order was not as agreed you are refunded to the number that paid.</p>

        <div className="space-y-2 mb-4" role="radiogroup" aria-label="What went wrong">
          {REASONS.map(r => (
            <button key={r.key} role="radio" aria-checked={reason === r.key} onClick={() => setReason(r.key)}
              className={`w-full text-left px-4 h-12 rounded-xl border text-[15px] transition-colors ${reason === r.key ? 'border-brand-green bg-brand-green/10 text-[var(--c-text)] font-semibold' : 'border-[var(--c-border)] text-[var(--c-text-2)] hover:bg-[var(--c-raised)]'}`}>
              {r.label}
            </button>
          ))}
        </div>

        <label htmlFor="problem-desc" className="text-sm font-medium text-[var(--c-text-2)]">What happened?</label>
        <textarea id="problem-desc" value={description} onChange={e => setDescription(e.target.value.slice(0, 2000))} rows={4}
          placeholder="e.g. 20 of the 50 bags were soaked and the produce inside had rotted."
          className="mt-1.5 w-full rounded-xl bg-[var(--c-input)] border border-[var(--c-border)] px-3 py-2.5 text-[15px] text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green resize-none" />

        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

        <button onClick={submit} disabled={!ready || sending}
          className="mt-4 w-full h-12 rounded-xl bg-[var(--c-text)] text-[var(--c-bg)] font-bold disabled:opacity-40 flex items-center justify-center gap-2 press">
          {sending && <Loader2 className="h-4 w-4 animate-spin" />} Send report
        </button>
      </motion.div>
    </div>,
    document.body,
  )
}
