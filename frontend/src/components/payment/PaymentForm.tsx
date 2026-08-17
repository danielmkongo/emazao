import { useState } from 'react'
import { AlertTriangle, Smartphone, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface CollectResponse {
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SETTLED'
  channel?: string
  providerRef: string
}

/**
 * Mobile money checkout. Unlike a card form there is nothing to "confirm" in the
 * browser: we ask the provider to push a USSD prompt to the buyer's handset, they
 * approve it with their PIN, and the provider tells our webhook. So this form
 * hands off to a waiting state rather than reporting success itself.
 */
export function PaymentForm({
  orderId,
  onSuccess,
  onCancel,
}: {
  orderId: string
  onSuccess: () => void
  onCancel?: () => void
}) {
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pushSent, setPushSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await api.post<ApiResponse<CollectResponse>>('/payments/collect', {
        orderId,
        phoneNumber: phone.trim(),
      })
      const data = res.data.data

      if (data?.status === 'FAILED') {
        setError('The payment request was rejected. Check the number and try again.')
        setSubmitting(false)
        return
      }
      setPushSent(true)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not reach the payment service. Please try again.')
      setSubmitting(false)
    }
  }

  if (pushSent) {
    return (
      <div className="space-y-4 text-center py-2">
        <div className="mx-auto w-14 h-14 rounded-full bg-brand-green/15 flex items-center justify-center">
          <Smartphone className="h-7 w-7 text-brand-green" />
        </div>
        <div>
          <p className="font-semibold text-[var(--c-text)]">Check your phone</p>
          <p className="text-sm text-[var(--c-text-3)] mt-1">
            We sent a payment request to <span className="font-medium">{phone}</span>. Enter your mobile
            money PIN to approve it.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-[var(--c-text-3)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for confirmation…
        </div>
        <p className="text-xs text-[var(--c-text-4)]">
          Your order updates automatically once the payment clears. You can safely close this window.
        </p>
        <Button type="button" variant="outline" className="w-full" onClick={onSuccess}>
          Done
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="momo-phone" className="text-sm text-[var(--c-text-3)] mb-2 block">
          Mobile money number
        </label>
        <input
          id="momo-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="0712 345 678"
          required
          className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green"
        />
        <p className="text-xs text-[var(--c-text-4)] mt-2">
          M-Pesa, Airtel Money, Mixx by Yas or HaloPesa. You'll get a prompt on this number.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="flex-[2]" disabled={!phone.trim() || submitting} loading={submitting}>
          {submitting ? 'Sending request…' : 'Pay with mobile money'}
        </Button>
      </div>
    </form>
  )
}
