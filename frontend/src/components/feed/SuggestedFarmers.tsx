import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

interface Ranked { user: User; credibility?: number }

/**
 * "Suggested for you", woven into the feed the way Instagram does it: a row of
 * farmers worth following, each one tap away. Following someone here is how a
 * new buyer's feed stops being generic.
 */
export function SuggestedFarmers() {
  const { t } = useTranslation()
  const me = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const [state, setState] = useState<Record<string, 'following' | 'hidden'>>({})

  const { data } = useQuery({
    queryKey: ['suggested-farmers', me?._id],
    queryFn: async () => {
      // A suggestion to follow someone you already follow is noise.
      const [ranked, following] = await Promise.all([
        api.get<ApiResponse<Ranked[]>>('/users/top-farmers?limit=20'),
        me ? api.get<ApiResponse<User[]>>(`/users/${me.username}/following`).catch(() => null) : null,
      ])
      const followed = new Set((following?.data.data ?? []).map(u => u._id))
      return (ranked.data.data ?? []).filter(d => d.user && d.user._id !== me?._id && !followed.has(d.user._id)).slice(0, 12)
    },
    staleTime: 5 * 60_000,
  })

  const follow = async (id: string) => {
    const was = state[id]
    setState(s => ({ ...s, [id]: was === 'following' ? undefined! : 'following' }))
    try {
      const res = await api.post<ApiResponse<{ following: boolean }>>(`/users/${id}/follow`)
      setState(s => ({ ...s, [id]: res.data.data?.following ? 'following' : undefined! }))
      queryClient.invalidateQueries({ queryKey: ['stories', 'feed'] })
    } catch { setState(s => ({ ...s, [id]: was })) }
  }

  const list = (data ?? []).filter(f => state[f.user._id] !== 'hidden')
  if (!list.length) return null

  return (
    <section className="py-4 md:py-5 md:border md:border-[var(--c-border)] md:rounded-2xl md:bg-[var(--c-card)]">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-[15px] font-semibold text-[var(--c-text)]">{t('panel.suggested')}</h2>
        <Link to="/explore?tab=farmers" className="text-[13.5px] font-semibold text-brand-green">{t('common.seeAll')}</Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 snap-x">
        {list.map(({ user: u, credibility }) => {
          const following = state[u._id] === 'following'
          return (
            <div key={u._id} className="relative w-[156px] flex-shrink-0 snap-start rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-3.5 pt-4 flex flex-col items-center text-center">
              <button onClick={() => setState(s => ({ ...s, [u._id]: 'hidden' }))} aria-label={t('feed.dismiss')}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)]">
                <X className="h-4 w-4" />
              </button>
              <Link to={`/profile/${u.username}`} className="flex flex-col items-center min-w-0 w-full">
                {u.avatar
                  ? <img src={u.avatar} alt="" className="w-[76px] h-[76px] rounded-full object-cover mb-2.5" />
                  : <span className="w-[76px] h-[76px] rounded-full bg-gradient-to-br from-brand-green to-ink mb-2.5" />}
                <span className="flex items-center gap-1 max-w-full">
                  <span className="text-[13.5px] font-semibold text-[var(--c-text)] truncate">{u.name}</span>
                  {u.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-brand-green flex-shrink-0" />}
                </span>
                <span className="text-[12px] text-[var(--c-text-3)] truncate max-w-full">
                  {credibility !== undefined ? t('panel.credibility', { value: credibility }) : (u.country ?? t('panel.farmer'))}
                </span>
              </Link>
              <button onClick={() => follow(u._id)}
                className={`mt-3 w-full h-8 rounded-lg text-[13px] font-semibold transition-colors press ${following
                  ? 'bg-[var(--c-raised)] text-[var(--c-text)]'
                  : 'bg-brand-green text-white hover:bg-brand-emerald'}`}>
                {following ? t('common.following') : t('common.follow')}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
