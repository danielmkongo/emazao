import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useStoryFeed, useStoryUI } from '@/lib/stories'
import { useLiveSessions } from '@/components/feed/LiveNowRow'
import { StoryAvatar } from './StoryAvatar'

const SIZE = 62

/**
 * The row of circles across the top of the feed. In order: you, whoever is
 * live right now, then stories — unseen first. Live sits up front because it is
 * the one thing here that disappears if you do not tap it now.
 */
export function StoriesRail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const me = useAuthStore(s => s.user)
  const { data: groups, isLoading } = useStoryFeed()
  const live = useLiveSessions().filter(s => s.broadcasterId._id !== me?._id)
  const openViewer = useStoryUI(s => s.openViewer)
  const openComposer = useStoryUI(s => s.openComposer)

  if (!me) return null
  const all = groups ?? []
  const mine = all.find(g => g.user._id === me._id)
  const others = all.filter(g => g.user._id !== me._id)

  return (
    <div className="flex gap-3.5 overflow-x-auto no-scrollbar px-4 py-3 snap-x scroll-px-4" role="list" aria-label={t('stories.rail')}>
      {/* You */}
      <div className="flex flex-col items-center gap-1.5 w-[74px] flex-shrink-0 snap-start" role="listitem">
        <div className="relative">
          <StoryAvatar
            user={me}
            size={SIZE}
            group={mine ?? null}
            onNoStory={openComposer}
          />
          <button
            onClick={openComposer}
            aria-label={t('stories.add')}
            className="absolute bottom-0 right-0 w-[22px] h-[22px] rounded-full bg-brand-green text-white flex items-center justify-center ring-[3px] ring-[var(--c-bg)] press"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </div>
        <span className="text-[11.5px] text-[var(--c-text-2)] truncate max-w-full">{t('stories.yours')}</span>
      </div>

      {/* Live now */}
      {live.map(s => (
        <button
          key={s._id}
          onClick={() => navigate(`/live/${s.broadcasterId._id}`)}
          className="flex flex-col items-center gap-1.5 w-[74px] flex-shrink-0 snap-start press"
          role="listitem"
        >
          <span className="relative">
            <span className="block rounded-full p-[2.5px] bg-gradient-to-tr from-red-600 via-red-500 to-orange-400">
              <span className="block rounded-full p-[2.5px] bg-[var(--c-bg)]">
                {s.broadcasterId.avatar
                  ? <img src={s.broadcasterId.avatar} alt="" className="rounded-full object-cover" style={{ width: SIZE, height: SIZE }} />
                  : <span className="block rounded-full bg-red-500" style={{ width: SIZE, height: SIZE }} />}
              </span>
            </span>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-px rounded-[5px] bg-red-600 text-white text-[9px] font-extrabold tracking-wider ring-2 ring-[var(--c-bg)]">
              LIVE
            </span>
          </span>
          <span className="text-[11.5px] text-[var(--c-text)] truncate max-w-full">{s.broadcasterId.name.split(' ')[0]}</span>
        </button>
      ))}

      {/* Stories */}
      {others.map(g => (
        <button
          key={g.user._id}
          onClick={() => openViewer(others, others.indexOf(g))}
          className="flex flex-col items-center gap-1.5 w-[74px] flex-shrink-0 snap-start press"
          role="listitem"
        >
          {/* The rail button handles the tap so the viewer can continue into
              the next person's stories, which a lone avatar cannot. */}
          <span className="pointer-events-none"><StoryAvatar user={g.user} size={SIZE} group={g} /></span>
          <span className={`text-[11.5px] truncate max-w-full ${g.allSeen ? 'text-[var(--c-text-3)]' : 'text-[var(--c-text)] font-medium'}`}>
            {g.user.name.split(' ')[0]}
          </span>
        </button>
      ))}

      {isLoading && [...Array(5)].map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 w-[74px] flex-shrink-0">
          <div className="rounded-full skeleton-shimmer" style={{ width: SIZE + 8, height: SIZE + 8 }} />
          <div className="h-2.5 w-12 rounded-full skeleton-shimmer" />
        </div>
      ))}
    </div>
  )
}
