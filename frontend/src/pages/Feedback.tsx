import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bug, Lightbulb, Frown, Heart, MessageCircle, Star, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

const CATEGORIES = [
  { key: 'SUGGESTION', icon: Lightbulb, en: 'Suggestion', sw: 'Pendekezo' },
  { key: 'BUG', icon: Bug, en: 'Something is broken', sw: 'Kuna tatizo' },
  { key: 'COMPLAINT', icon: Frown, en: 'Complaint', sw: 'Malalamiko' },
  { key: 'PRAISE', icon: Heart, en: 'Something I like', sw: 'Ninachopenda' },
  { key: 'OTHER', icon: MessageCircle, en: 'Other', sw: 'Mengineyo' },
] as const

/**
 * Tell the eMazao team something. Private — this goes to the operators, never
 * onto a seller's page — and open to signed-out visitors, because someone who
 * cannot get through signup is exactly who most needs to be heard.
 */
export default function Feedback() {
  const { i18n } = useTranslation()
  const sw = i18n.resolvedLanguage === 'sw'
  const { isAuthenticated } = useAuthStore()

  const [category, setCategory] = useState<string>('SUGGESTION')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const send = useMutation({
    mutationFn: () => api.post('/feedback', {
      category,
      message: message.trim(),
      rating: rating || undefined,
      page: document.referrer ? new URL(document.referrer).pathname : undefined,
      name: isAuthenticated ? undefined : name.trim() || undefined,
      email: isAuthenticated ? undefined : email.trim() || undefined,
    }),
  })

  if (send.isSuccess) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-7 w-7 text-brand-green" />
        </div>
        <h1 className="text-xl font-bold text-[var(--c-text)]">{sw ? 'Asante!' : 'Thank you'}</h1>
        <p className="text-[var(--c-text-3)] text-sm mt-2">
          {sw
            ? 'Tumepokea ujumbe wako. Timu ya eMazao inasoma kila ujumbe.'
            : 'We have your message. The eMazao team reads every one.'}
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => { send.reset(); setMessage(''); setRating(0) }}>
          {sw ? 'Tuma ujumbe mwingine' : 'Send another'}
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--c-text)]">{sw ? 'Maoni na Mapendekezo' : 'Feedback'}</h1>
      <p className="text-[var(--c-text-3)] text-sm mt-1 mb-6">
        {sw
          ? 'Tuambie jinsi tunavyoweza kuboresha huduma. Ujumbe huu unaenda kwa timu ya eMazao tu.'
          : 'Tell us how we can improve. This goes to the eMazao team only — never onto anyone’s public page.'}
      </p>

      <p className="text-sm font-medium text-[var(--c-text-2)] mb-2">{sw ? 'Ni kuhusu nini?' : 'What is it about?'}</p>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {CATEGORIES.map(c => {
          const Icon = c.icon
          const on = category === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              aria-pressed={on}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border text-left transition-colors ${
                on ? 'bg-brand-green/10 border-brand-green text-brand-green' : 'bg-[var(--c-card)] border-[var(--c-border)] text-[var(--c-text-2)] hover:text-[var(--c-text)]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {sw ? c.sw : c.en}
            </button>
          )
        })}
      </div>

      <label htmlFor="feedback-message" className="block text-sm font-medium text-[var(--c-text-2)] mb-1.5">
        {sw ? 'Ujumbe wako' : 'Your message'}
      </label>
      <textarea
        id="feedback-message"
        rows={6}
        value={message}
        onChange={e => setMessage(e.target.value)}
        maxLength={4000}
        placeholder={sw ? 'Andika hapa…' : 'Write here…'}
        className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green"
      />
      <p className="text-[var(--c-text-4)] text-[11px] text-right mt-1 mb-4 tabular-nums">{message.length}/4000</p>

      <p className="text-sm font-medium text-[var(--c-text-2)] mb-2">
        {sw ? 'Unaridhika kiasi gani na eMazao?' : 'How happy are you with eMazao?'}
        <span className="text-[var(--c-text-4)] font-normal"> {sw ? '(si lazima)' : '(optional)'}</span>
      </p>
      <div className="flex gap-1 mb-5">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n}`} className="p-1">
            <Star className={`h-7 w-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-[var(--c-border)]'}`} />
          </button>
        ))}
      </div>

      {!isAuthenticated && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label htmlFor="feedback-name" className="block text-sm font-medium text-[var(--c-text-2)] mb-1.5">{sw ? 'Jina' : 'Name'}</label>
            <input id="feedback-name" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green" />
          </div>
          <div>
            <label htmlFor="feedback-email" className="block text-sm font-medium text-[var(--c-text-2)] mb-1.5">{sw ? 'Barua pepe' : 'Email'}</label>
            <input id="feedback-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] focus:outline-none focus:border-brand-green" />
          </div>
          <p className="col-span-2 text-[var(--c-text-4)] text-xs -mt-1">
            {sw ? 'Ili tuweze kukujibu.' : 'So we can reply to you.'}
          </p>
        </div>
      )}

      {send.isError && (
        <p className="text-red-500 text-sm mb-3">
          {(send.error as any)?.response?.data?.message ?? (sw ? 'Imeshindikana kutuma.' : 'Could not send.')}
        </p>
      )}

      <Button className="w-full" size="lg" disabled={!message.trim() || send.isPending} onClick={() => send.mutate()}>
        {send.isPending ? (sw ? 'Inatuma…' : 'Sending…') : (sw ? 'Tuma' : 'Send feedback')}
      </Button>
    </div>
  )
}
