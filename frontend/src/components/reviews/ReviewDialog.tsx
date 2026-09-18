import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

/**
 * Rate the seller's service on a delivered order.
 */
export function ReviewDialog({
  orderId, orderNumber, sellerName, sellerId, onClose,
}: {
  orderId: string; orderNumber: string; sellerName: string; sellerId?: string; onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [content, setContent] = useState('')

  const submit = useMutation({
    mutationFn: () => api.post('/reviews', { orderId, rating, content: content.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewable'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      if (sellerId) queryClient.invalidateQueries({ queryKey: ['seller-reviews', sellerId] })
      onClose()
    },
  })

  const shown = hover || rating

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl shadow-2xl p-5 z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-[var(--c-text)]">Rate {sellerName}</h2>
            <p className="text-[var(--c-text-3)] text-sm mt-0.5">Order {orderNumber}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5 mb-4">
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star className={`h-8 w-8 ${n <= shown ? 'fill-amber-400 text-amber-400' : 'text-[var(--c-border)]'}`} />
              </button>
            ))}
          </div>
          <p className="text-sm font-medium text-[var(--c-text-2)] h-5">{LABELS[shown]}</p>
        </div>

        <label htmlFor="review-content" className="block text-[var(--c-text-2)] text-sm font-medium mb-1.5">
          How was the service?
        </label>
        <textarea
          id="review-content"
          rows={4}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Quality of the produce, packaging, how quickly it arrived, how the seller communicated…"
          className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] mb-4 focus:outline-none focus:border-brand-green"
        />

        {submit.isError && (
          <p className="text-red-500 text-sm mb-3">
            {(submit.error as any)?.response?.data?.message ?? 'Could not submit your review.'}
          </p>
        )}

        <div className="flex gap-2">
          <Button className="flex-1" disabled={!rating || !content.trim() || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? 'Submitting…' : 'Submit review'}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
