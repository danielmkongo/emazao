import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { stripePromise } from '@/lib/stripe'

function InnerForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel?: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      onSuccess()
    } else {
      setError('Payment did not complete. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
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
        <Button type="submit" className="flex-[2]" disabled={!stripe || submitting} loading={submitting}>
          {submitting ? 'Processing…' : 'Pay now'}
        </Button>
      </div>
    </form>
  )
}

export function PaymentForm({
  clientSecret,
  onSuccess,
  onCancel,
}: {
  clientSecret: string
  onSuccess: () => void
  onCancel?: () => void
}) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <InnerForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  )
}
