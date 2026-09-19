import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Smartphone, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface CollectResponse {
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SETTLED'
  channel?: string
  providerRef: string
  amount?: number
}

type VerifyStatus = 'PAID' | 'PROCESSING' | 'FAILED' | 'UNKNOWN' | 'CANCELLED'

/** Accepts 0712…, 712…, +255712…, 255712… — the ways people actually type it. */
function isTzMobile(raw: string) {
  const d = raw.replace(/\D/g, '')
  const local = d.startsWith('255') ? d.slice(3) : d.startsWith('0') ? d.slice(1) : d
  return /^[67]\d{8}$/.test(local)
}

const POLL_MS = 4000
const GIVE_UP_MS = 3 * 60_000

/**
 * Mobile money checkout. We ask the provider to push a USSD prompt to the
 * buyer's handset; they approve with their PIN. Rather than leaving them on an
 * open-ended "waiting…", this screen keeps asking the server, which checks
 * with the provider directly, and flips to "Payment received" the moment it
 * clears — whether or not the provider's webhook has arrived.
 */
export function PaymentForm({
  orderId,
  checkoutId,
  onSuccess,
  onCancel,
}: {
  /** Pay a single order… */
  orderId?: string
  /** …or several sellers' orders from one cart checkout, in one approval. */
  checkoutId?: string
  onSuccess: () => void
  onCancel?: () => void
}) {
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [stage, setStage] = useState<'form' | 'waiting' | 'paid' | 'timeout'>('form')
  const [error, setError] = useState<string | null>(null)
  const startedAt = useRef(0)

  const target = checkoutId ? { checkoutId } : { orderId }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isTzMobile(phone)) { setError('Enter a Tanzanian mobile number, e.g. 0712 345 678'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.post<ApiResponse<CollectResponse>>('/payments/collect', { ...target, phoneNumber: phone.trim() })
      if (res.data.data?.status === 'FAILED') {
        setError('The payment request was rejected. Check the number and try again.')
        return
      }
      startedAt.current = Date.now()
      setStage('waiting')
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not reach the payment service. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // While waiting, ask every few seconds until it clears, fails or we give up.
  useEffect(() => {
    if (stage !== 'waiting') return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await api.post<ApiResponse<{ status: VerifyStatus; shortfall?: boolean }>>('/payments/verify', target)
        if (cancelled) return
        const s = res.data.data?.status
        if (s === 'PAID') { setStage('paid'); return }
        if (s === 'FAILED' || s === 'CANCELLED') {
          setError(s === 'CANCELLED' ? 'This order was cancelled.' : 'The payment did not go through — it may have been declined or timed out. You can try again.')
          setStage('form')
          return
        }
        if (res.data.data?.shortfall) {
          setError('The amount received did not cover the order. Contact support with your transaction message.')
          setStage('form')
          return
        }
      } catch { /* keep waiting */ }
      if (Date.now() - startedAt.current > GIVE_UP_MS) setStage('timeout')
    }
    const id = window.setInterval(tick, POLL_MS)
    void tick()
    return () => { cancelled = true; window.clearInterval(id) }
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === 'paid') {
    return (
      <div className="space-y-4 text-center py-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-brand-green/15 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-brand-green" />
        </div>
        <div>
          <p className="font-bold text-lg text-[var(--c-text)]">Payment received</p>
          <p className="text-sm text-[var(--c-text-3)] mt-1">
            Your money is held safely by eMazao and only goes to the seller when you confirm delivery.
          </p>
        </div>
        <Button type="button" className="w-full" onClick={onSuccess}>Continue</Button>
      </div>
    )
  }

  if (stage === 'waiting' || stage === 'timeout') {
    return (
      <div className="space-y-4 text-center py-2">
        <div className="mx-auto w-14 h-14 rounded-full bg-brand-green/15 flex items-center justify-center">
          <Smartphone className="h-7 w-7 text-brand-green" />
        </div>
        <div>
          <p className="font-semibold text-[var(--c-text)]">{stage === 'timeout' ? 'Still waiting for your approval' : 'Check your phone'}</p>
          <p className="text-sm text-[var(--c-text-3)] mt-1">
            {stage === 'timeout'
              ? 'If you approved it, the order will update on its own shortly. If no prompt arrived, send it again.'
              : <>We sent a payment request to <span className="font-medium text-[var(--c-text)]">{phone}</span>. Enter your mobile money PIN to approve it.</>}
          </p>
        </div>
        {stage === 'waiting' && (
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--c-text-3)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Waiting for confirmation…
          </div>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => { setStage('form'); setError(null) }}>
            Send again
          </Button>
          <Button type="button" variant="secondary" className="flex-1" onClick={onSuccess}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="momo-phone" className="text-sm text-[var(--c-text-3)] mb-2 block">Mobile money number</label>
        <input
          id="momo-phone" type="tel" inputMode="tel" autoComplete="tel"
          value={phone} onChange={e => { setPhone(e.target.value); setError(null) }}
          placeholder="0712 345 678" required
          className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green"
        />
        <p className="text-xs text-[var(--c-text-4)] mt-2">M-Pesa, Airtel Money, Mixx by Yas or HaloPesa. You'll get a prompt on this number.</p>
      </div>

      <div className="flex items-start gap-2 text-xs text-[var(--c-text-3)]">
        <ShieldCheck className="h-4 w-4 text-brand-green flex-shrink-0" />
        <span>Held by eMazao until you confirm delivery. If there's a problem, report it and you can be refunded.</span>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>Cancel</Button>
        )}
        <Button type="submit" className="flex-[2]" disabled={!phone.trim() || submitting} loading={submitting}>
          {submitting ? 'Sending request…' : 'Pay with mobile money'}
        </Button>
      </div>
    </form>
  )
}
