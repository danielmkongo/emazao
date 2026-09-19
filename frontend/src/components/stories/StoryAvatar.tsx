import { cn } from '@/lib/utils'
import { useStoryUI, useUserStories, type StoryGroup } from '@/lib/stories'

interface StoryAvatarProps {
  user: { _id: string; name?: string; avatar?: string; isVerified?: boolean }
  /** Diameter of the photo in px; the ring adds a few px around it. */
  size?: number
  /** Pass when the caller already has the stories (the rail); otherwise… */
  group?: StoryGroup | null
  /** …set this to look them up, for one-off avatars like a profile header. */
  lookup?: boolean
  /** What a tap does when there are no stories to open. */
  onNoStory?: () => void
  className?: string
}

function initials(name?: string) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'
}

/**
 * An avatar that carries the story ring. Colour means something new to watch,
 * grey means you have seen it all, no ring means nothing is up. Tapping a
 * ringed avatar plays that person's stories right where you are.
 */
export function StoryAvatar({ user, size = 56, group, lookup, onNoStory, className }: StoryAvatarProps) {
  const { data: fetched } = useUserStories(lookup && !group ? user._id : undefined)
  const openViewer = useStoryUI(s => s.openViewer)
  const g = group ?? fetched ?? null
  const hasStory = !!g?.stories.length
  const ring = Math.max(2, Math.round(size / 28))
  const gap = Math.max(2, Math.round(size / 24))

  const photo = user.avatar ? (
    <img src={user.avatar} alt={user.name ?? ''} className="w-full h-full rounded-full object-cover" draggable={false} />
  ) : (
    <div className="w-full h-full rounded-full bg-gradient-to-br from-brand-green to-ink flex items-center justify-center text-white font-semibold"
      style={{ fontSize: size * 0.34 }}>
      {initials(user.name)}
    </div>
  )

  const body = (
    <span
      className={cn('relative inline-flex rounded-full flex-shrink-0', hasStory && (g!.allSeen ? 'story-ring-seen' : 'story-ring'))}
      style={{ padding: hasStory ? ring : 0, width: size + (hasStory ? (ring + gap) * 2 : 0), height: size + (hasStory ? (ring + gap) * 2 : 0) }}
    >
      <span className="block w-full h-full rounded-full bg-[var(--c-bg)]" style={{ padding: hasStory ? gap : 0 }}>
        {photo}
      </span>
    </span>
  )

  if (!hasStory && !onNoStory) return <span className={cn('inline-flex', className)}>{body}</span>
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation()
        if (hasStory) openViewer([g!])
        else onNoStory?.()
      }}
      aria-label={hasStory ? `Watch ${user.name ?? 'their'} story` : user.name}
      className={cn('inline-flex rounded-full press', className)}
    >
      {body}
    </button>
  )
}
