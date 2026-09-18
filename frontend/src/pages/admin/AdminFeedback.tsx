import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Inbox, Bug, Lightbulb, Frown, Heart, MessageCircle, Star } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface FeedbackRow {
  _id: string
  userId?: { name: string; email: string; customerId?: string }
  name?: string
  email?: string
  category: string
  message: string
  rating?: number
  page?: string
  status: 'NEW' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED'
  adminNote?: string
  createdAt: string
}

interface FeedbackPage {
  rows: FeedbackRow[]
  total: number
  counts: Record<string, number>
}

const ICON: Record<string, typeof Bug> = {
  BUG: Bug, SUGGESTION: Lightbulb, COMPLAINT: Frown, PRAISE: Heart, OTHER: MessageCircle,
}
const TONE: Record<string, string> = {
  BUG: 'bg-red-500/10 text-red-500',
  COMPLAINT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  SUGGESTION: 'bg-blue-500/10 text-blue-500',
  PRAISE: 'bg-brand-green/10 text-brand-green',
  OTHER: 'bg-[var(--c-raised)] text-[var(--c-text-3)]',
}
const STATUSES = ['NEW', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const

export default function AdminFeedback() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<string>('NEW')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-feedback', status],
    queryFn: async () => {
      const res = await api.get<ApiResponse<FeedbackPage>>(`/feedback?status=${status}&limit=50`)
      return res.data.data
    },
    placeholderData: keepPreviousData,
  })

  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => api.put(`/feedback/${id}`, { status: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feedback'] })
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
    },
  })

  return (
    <div className="p-5 space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-lg font-bold text-[var(--c-text)]">Feedback</h1>
        <p className="text-[var(--c-text-3)] text-xs mt-0.5">
          What users are telling the team about eMazao itself. Private — none of this appears on a public page.
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {['ALL', ...STATUSES].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === s ? 'bg-brand-green text-white' : 'bg-[var(--c-card)] border border-[var(--c-border)] text-[var(--c-text-2)] hover:text-[var(--c-text)]'
            }`}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            {s !== 'ALL' && data?.counts?.[s] ? <span className="ml-1.5 tabular-nums opacity-70">{data.counts[s]}</span> : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      ) : !data?.rows.length ? (
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg text-center py-16 px-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-3">
            <Inbox className="h-5 w-5 text-[var(--c-text-4)]" />
          </div>
          <p className="text-[var(--c-text)] font-semibold">Nothing here</p>
          <p className="text-[var(--c-text-3)] text-sm mt-1">
            {status === 'NEW' ? 'Every piece of feedback has been looked at.' : 'No feedback in this state.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.rows.map(f => {
            const Icon = ICON[f.category] ?? MessageCircle
            const who = f.userId?.name ?? f.name ?? 'Anonymous visitor'
            const contact = f.userId?.email ?? f.email
            return (
              <div key={f._id} className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TONE[f.category] ?? TONE.OTHER}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[var(--c-text)] text-sm font-semibold">{who}</span>
                      {f.userId?.customerId && <span className="font-mono text-[11px] text-[var(--c-text-4)]">{f.userId.customerId}</span>}
                      {f.rating && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-500 font-semibold">
                          <Star className="h-3 w-3 fill-amber-400" />{f.rating}
                        </span>
                      )}
                      <span className="text-[var(--c-text-4)] text-[11px] ml-auto">{timeAgo(f.createdAt)}</span>
                    </div>
                    <p className="text-[var(--c-text-2)] text-sm whitespace-pre-wrap break-words">{f.message}</p>
                    <div className="flex items-center gap-3 flex-wrap mt-2 text-[11px] text-[var(--c-text-4)]">
                      {contact && <span>{contact}</span>}
                      {f.page && <span className="font-mono">from {f.page}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1.5 mt-3 pl-12 flex-wrap">
                  {STATUSES.filter(s => s !== f.status).map(s => (
                    <button
                      key={s}
                      onClick={() => update.mutate({ id: f._id, next: s })}
                      disabled={update.isPending}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--c-raised)] text-[var(--c-text-2)] hover:text-[var(--c-text)] disabled:opacity-40 transition-colors"
                    >
                      Mark {s.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
