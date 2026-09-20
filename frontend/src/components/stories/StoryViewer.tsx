import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { likeHaptic, unlikeHaptic, sendHaptic } from '@/lib/haptics'
import { X, Send, Eye, Trash2, Volume2, VolumeX, ChevronLeft, ChevronRight, ShoppingBag, Loader2, MoreHorizontal } from 'lucide-react'
import { router } from '@/router'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import api from '@/lib/api'
import {
  useStoryUI, markStorySeenLocally, refreshStories, STORY_REACTIONS, STORY_BACKGROUNDS,
  type Story, type StoryGroup,
} from '@/lib/stories'
import type { ApiResponse, User } from '@/types'

const IMAGE_MS = 5500
const MAX_VIDEO_MS = 60_000

export function shortAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - +new Date(iso)) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

/** Where to begin in someone's stories: the first one you have not seen. */
function startIndex(g: StoryGroup) {
  const i = g.stories.findIndex(s => !s.seen)
  return i === -1 ? 0 : i
}

export default function StoryViewer() {
  const { viewerOpen, groups, groupIndex, closeViewer, setGroupIndex } = useStoryUI()
  const group = groups[groupIndex]
  if (!viewerOpen || !group) return null
  return createPortal(
    <GroupPlayer
      key={group.user._id}
      group={group}
      hasPrev={groupIndex > 0}
      hasNext={groupIndex < groups.length - 1}
      onPrevGroup={() => setGroupIndex(groupIndex - 1)}
      onNextGroup={() => (groupIndex < groups.length - 1 ? setGroupIndex(groupIndex + 1) : closeViewer())}
      onClose={closeViewer}
    />,
    document.body,
  )
}

interface PlayerProps {
  group: StoryGroup
  hasPrev: boolean
  hasNext: boolean
  onPrevGroup: () => void
  onNextGroup: () => void
  onClose: () => void
}

function GroupPlayer({ group, hasPrev, hasNext, onPrevGroup, onNextGroup, onClose }: PlayerProps) {
  const { t } = useTranslation()
  const me = useAuthStore(s => s.user)
  const isOwn = me?._id === group.user._id
  const [stories, setStories] = useState(group.stories)
  const [index, setIndex] = useState(() => startIndex(group))
  const story: Story | undefined = stories[index]

  const [progress, setProgress] = useState(0)
  const [held, setHeld] = useState(false)          // finger down: pause + hide chrome
  const [typing, setTyping] = useState(false)      // reply box focused: pause
  const [sheet, setSheet] = useState<'viewers' | 'menu' | null>(null)
  const [muted, setMuted] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const paused = held || typing || !!sheet || !loaded

  const videoRef = useRef<HTMLVideoElement>(null)
  const elapsedRef = useRef(0)

  // ─── Advance ─────────────────────────────────────────────────────────────
  const next = useCallback(() => {
    if (index < stories.length - 1) setIndex(i => i + 1)
    else onNextGroup()
  }, [index, stories.length, onNextGroup])

  const prev = useCallback(() => {
    if (index > 0) setIndex(i => i - 1)
    else if (hasPrev) onPrevGroup()
    else { elapsedRef.current = 0; setProgress(0); if (videoRef.current) videoRef.current.currentTime = 0 }
  }, [index, hasPrev, onPrevGroup])

  // New story: reset the clock and record the view.
  useEffect(() => {
    elapsedRef.current = 0
    setProgress(0)
    setLoaded(!story?.mediaUrl) // text stories are ready at once
    if (!story || isOwn) return
    if (!story.seen) {
      markStorySeenLocally(story._id)
      setStories(ss => ss.map(s => (s._id === story._id ? { ...s, seen: true } : s)))
    }
    api.post(`/stories/${story._id}/view`).catch(() => {})
  }, [story?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Image and text stories run on a clock; video follows its own playhead.
  useEffect(() => {
    if (!story || story.mediaType === 'VIDEO' || paused) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      elapsedRef.current += now - last
      last = now
      const p = Math.min(1, elapsedRef.current / IMAGE_MS)
      setProgress(p)
      if (p >= 1) { next(); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [story?._id, story?.mediaType, paused, next]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = videoRef.current
    if (!v || story?.mediaType !== 'VIDEO') return
    if (paused && loaded) { v.pause(); return }
    if (!paused) {
      v.muted = muted
      // Opening a story is a tap, which usually permits sound. When a browser
      // still refuses, fall back to muted rather than a frozen frame.
      v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}) })
    }
  }, [paused, loaded, muted, story?._id, story?.mediaType])

  const onVideoTime = () => {
    const v = videoRef.current
    if (!v || !v.duration) return
    const dur = Math.min(v.duration * 1000, MAX_VIDEO_MS)
    const p = Math.min(1, (v.currentTime * 1000) / dur)
    setProgress(p)
    if (p >= 0.999) next()
  }

  // Keyboard, for desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing) { if (e.key === 'Escape') (document.activeElement as HTMLElement)?.blur(); return }
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') onClose()
      else if (e.key === ' ') { e.preventDefault(); setHeld(h => !h) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose, typing])

  // Lock page scroll underneath.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  // Preload the next image so tapping forward never shows a blank frame.
  useEffect(() => {
    const n = stories[index + 1]
    if (n?.mediaType === 'IMAGE' && n.mediaUrl) { const img = new Image(); img.src = n.mediaUrl }
  }, [index, stories])

  // ─── Gestures ────────────────────────────────────────────────────────────
  // Tap left/right thirds to step, hold anywhere to pause, drag down to close.
  const y = useMotionValue(0)
  const scale = useTransform(y, [0, 400], [1, 0.86])
  const backdrop = useTransform(y, [0, 400], [1, 0.2])
  const downAt = useRef<{ x: number; y: number; t: number } | null>(null)
  const holdTimer = useRef<number>()

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-tap]')) return
    downAt.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    holdTimer.current = window.setTimeout(() => setHeld(true), 180)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!downAt.current) return
    const dy = e.clientY - downAt.current.y
    if (dy > 0) y.set(dy)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    window.clearTimeout(holdTimer.current)
    const start = downAt.current
    downAt.current = null
    const wasHeld = held
    setHeld(false)
    if (!start) return
    const dy = e.clientY - start.y
    const dx = e.clientX - start.x
    if (dy > 120) { onClose(); return }
    animate(y, 0, { type: 'spring', stiffness: 500, damping: 40 })
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) { if (hasNext) onNextGroup(); else onClose() } else if (hasPrev) onPrevGroup()
      return
    }
    if (wasHeld || Date.now() - start.t > 250 || Math.abs(dy) > 10) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (e.clientX - rect.left < rect.width * 0.3) prev()
    else next()
  }

  // ─── Actions ─────────────────────────────────────────────────────────────
  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 1600) }

  const go = (path: string) => { onClose(); router.navigate(path) }

  const removeStory = async () => {
    if (!story) return
    setSheet(null)
    try {
      await api.delete(`/stories/${story._id}`)
      refreshStories()
      const remaining = stories.filter(s => s._id !== story._id)
      if (!remaining.length) { onClose(); return }
      setStories(remaining)
      setIndex(i => Math.min(i, remaining.length - 1))
    } catch { flash(t('stories.deleteFailed')) }
  }

  if (!story) return null
  const product = story.productId
  const chromeHidden = held

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={t('stories.viewerLabel', { name: group.user.name })}
    >
      {/* Backdrop: the story itself, blurred, so desktop's side space is not a black void. */}
      <motion.div className="absolute inset-0 bg-black" style={{ opacity: backdrop }}>
        {story.mediaType === 'IMAGE' && story.mediaUrl && (
          <img src={story.mediaUrl} alt="" className="hidden md:block w-full h-full object-cover opacity-40 blur-3xl scale-110" />
        )}
      </motion.div>

      {/* Desktop: step between people */}
      {hasPrev && (
        <button onClick={onPrevGroup} aria-label={t('stories.prevPerson')}
          className="hidden md:flex absolute left-[calc(50%-min(46vh,260px)-64px)] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-black items-center justify-center shadow-lg hover:bg-white z-10 press">
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {hasNext && (
        <button onClick={onNextGroup} aria-label={t('stories.nextPerson')}
          className="hidden md:flex absolute right-[calc(50%-min(46vh,260px)-64px)] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-black items-center justify-center shadow-lg hover:bg-white z-10 press">
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <motion.div
        style={{ y, scale }}
        className="relative w-full h-full md:w-auto md:h-[min(92vh,920px)] md:aspect-[9/16] md:rounded-2xl overflow-hidden bg-neutral-950 select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={e => e.preventDefault()}
      >
        {/* Media */}
        <AnimatePresence initial={false}>
          <motion.div
            key={story._id}
            className="absolute inset-0"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {story.mediaType === 'IMAGE' && story.mediaUrl && (
              <img src={story.mediaUrl} alt={story.caption ?? ''} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
                className="w-full h-full object-cover" draggable={false} />
            )}
            {story.mediaType === 'VIDEO' && story.mediaUrl && (
              <video ref={videoRef} src={story.mediaUrl} playsInline preload="auto" muted={muted}
                onLoadedData={() => setLoaded(true)} onError={() => setLoaded(true)} onTimeUpdate={onVideoTime} onEnded={next}
                className="w-full h-full object-cover" />
            )}
            {!story.mediaUrl && (
              <div className="w-full h-full flex items-center justify-center p-8" style={{ background: STORY_BACKGROUNDS[story.background ?? 'harvest'] }}>
                <p className="text-white text-center font-bold leading-tight text-balance drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
                  style={{ fontFamily: 'var(--font-display)', fontSize: story.text && story.text.length > 120 ? 24 : story.text && story.text.length > 50 ? 30 : 38 }}>
                  {story.text}
                </p>
              </div>
            )}
            {/* Text laid over a photo or video */}
            {story.mediaUrl && story.text && (
              <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
                <p className="px-3 py-1.5 rounded-xl bg-black/55 text-white text-xl font-bold text-center text-balance" style={{ fontFamily: 'var(--font-display)' }}>
                  {story.text}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="h-8 w-8 text-white/70 animate-spin" />
          </div>
        )}

        {/* Top scrim + progress + header */}
        <motion.div animate={{ opacity: chromeHidden ? 0 : 1 }} transition={{ duration: 0.15 }}
          className="absolute inset-x-0 top-0 pt-[calc(env(safe-area-inset-top,0px)+8px)] px-2.5 pb-10 bg-gradient-to-b from-black/60 via-black/25 to-transparent pointer-events-none">
          <div className="flex gap-1 mb-2.5">
            {stories.map((s, i) => (
              <div key={s._id} className="h-[2.5px] flex-1 rounded-full bg-white/35 overflow-hidden">
                <div className="h-full bg-white rounded-full"
                  style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2.5 pointer-events-auto" data-no-tap>
            <button onClick={() => go(`/profile/${group.user.username}`)} className="flex items-center gap-2.5 min-w-0 press">
              {group.user.avatar
                ? <img src={group.user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/30" />
                : <span className="w-8 h-8 rounded-full bg-brand-green" />}
              <span className="text-white text-[13.5px] font-semibold truncate">{group.user.name}</span>
              {group.user.isVerified && <VerifiedTick />}
              <span className="text-white/70 text-[13px] flex-shrink-0">{shortAgo(story.createdAt)}</span>
            </button>
            <div className="ml-auto flex items-center">
              {story.mediaType === 'VIDEO' && (
                <button onClick={() => setMuted(m => !m)} aria-label={muted ? t('stories.unmute') : t('stories.mute')}
                  className="w-10 h-10 flex items-center justify-center text-white press">
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
              )}
              {isOwn && (
                <button onClick={() => setSheet('menu')} aria-label={t('stories.more')} className="w-10 h-10 flex items-center justify-center text-white press">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              )}
              <button onClick={onClose} aria-label={t('common.close')} className="w-10 h-10 flex items-center justify-center text-white press">
                <X className="h-6 w-6" strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Product sticker — the shop window */}
        {product && (
          <motion.button
            data-no-tap
            animate={{ opacity: chromeHidden ? 0 : 1 }}
            onClick={() => go(`/marketplace/product/${product.slug || product._id}`)}
            className="absolute left-1/2 -translate-x-1/2 bottom-[132px] flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-2xl bg-white/95 text-black shadow-2xl max-w-[82%] press"
          >
            {product.images?.[0]
              ? <img src={product.images[0]} alt="" className="w-11 h-11 rounded-xl object-cover" />
              : <span className="w-11 h-11 rounded-xl bg-brand-green/15 flex items-center justify-center"><ShoppingBag className="h-5 w-5 text-brand-green" /></span>}
            <span className="min-w-0 text-left">
              <span className="block text-[12.5px] font-semibold truncate">{product.title}</span>
              <span className="block text-[13px] font-bold text-brand-green tabular">{formatCurrency(product.price)} <span className="text-black/50 font-medium">/ {product.priceUnit}</span></span>
            </span>
            <span className="ml-1 flex-shrink-0 text-[11px] font-bold uppercase tracking-wide bg-brand-green text-white rounded-full px-2.5 py-1">{t('stories.shop')}</span>
          </motion.button>
        )}

        {/* Caption */}
        {story.caption && (
          <motion.p animate={{ opacity: chromeHidden ? 0 : 1 }}
            className="absolute inset-x-4 bottom-[84px] text-white text-[14px] leading-snug text-center drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)] pointer-events-none">
            {story.caption}
          </motion.p>
        )}

        {/* Footer */}
        <motion.div animate={{ opacity: chromeHidden ? 0 : 1 }}
          className="absolute inset-x-0 bottom-0 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-10 bg-gradient-to-t from-black/60 to-transparent"
          data-no-tap>
          {isOwn ? (
            <button onClick={() => setSheet('viewers')} className="flex items-center gap-2 text-white/95 text-[13px] font-semibold px-2 py-2 press">
              <Eye className="h-[18px] w-[18px]" />
              {t('stories.seenBy', { count: story.viewCount })}
            </button>
          ) : (
            <ReplyBar
              story={story}
              ownerName={group.user.name.split(' ')[0]}
              onFocusChange={setTyping}
              onSent={(kind) => flash(kind === 'reaction' ? t('stories.reactionSent') : t('stories.replySent'))}
            />
          )}
        </motion.div>

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 px-4 py-2.5 rounded-2xl bg-black/75 text-white text-sm font-semibold backdrop-blur pointer-events-none">
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sheet === 'viewers' && <ViewersSheet storyId={story._id} onClose={() => setSheet(null)} onOpenProfile={u => go(`/profile/${u}`)} />}
          {sheet === 'menu' && (
            <Sheet onClose={() => setSheet(null)}>
              <button onClick={removeStory} className="w-full flex items-center gap-3 px-5 py-4 text-red-500 font-semibold text-[15px] hover:bg-white/5">
                <Trash2 className="h-5 w-5" /> {t('stories.delete')}
              </button>
              <button onClick={() => setSheet(null)} className="w-full px-5 py-4 text-white/80 font-medium text-[15px] border-t border-white/10 hover:bg-white/5">
                {t('common.cancel')}
              </button>
            </Sheet>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

function VerifiedTick() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" aria-label="Verified">
      <path fill="#16A34A" d="M12 1.5l2.6 1.9 3.2-.2 1 3.1 2.7 1.8-1 3.1 1 3.1-2.7 1.8-1 3.1-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3.1-2.7-1.8 1-3.1-1-3.1 2.7-1.8 1-3.1 3.2.2z" />
      <path fill="#fff" d="M10.6 15.6l-3.3-3.3 1.4-1.4 1.9 1.9 4.6-4.6 1.4 1.4z" />
    </svg>
  )
}

const LIKE = '❤️'

function ReplyBar({ story, ownerName, onFocusChange, onSent }: {
  story: Story; ownerName: string; onFocusChange: (v: boolean) => void; onSent: (kind: 'reaction' | 'reply') => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [sending, setSending] = useState(false)
  const [burst, setBurst] = useState<string | null>(null)

  // One reaction per viewer per story. `mine` is what the screen shows and
  // changes on the tap itself; `server` is what the server last confirmed;
  // `want` is where we are heading. Keeping the three apart is what makes
  // rapid tapping work — the old code refused a tap while a request was in
  // flight, so an impatient second tap did nothing at all and the reaction
  // appeared not to come off.
  const [mine, setMine] = useState<string | undefined>(story.myReaction)
  const server = useRef<string | undefined>(story.myReaction)
  const want = useRef<string | undefined>(story.myReaction)
  const inFlight = useRef(false)
  const touched = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setText('')
    touched.current = false
    setMine(story.myReaction)
    server.current = story.myReaction
    want.current = story.myReaction
  }, [story._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // A later refetch of the feed may carry the viewer's saved reaction, but it
  // must never overwrite one they have just tapped in this sitting.
  useEffect(() => {
    if (touched.current) return
    setMine(story.myReaction)
    server.current = story.myReaction
    want.current = story.myReaction
  }, [story.myReaction])

  /**
   * Walk the server to whatever the last tap asked for. The endpoint toggles,
   * so clearing a reaction means sending back the one that is there. Looping
   * rather than firing per tap means ten taps cost at most a couple of
   * requests and always settle on what the viewer last chose.
   */
  const flush = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      while (want.current !== server.current) {
        const target = want.current ?? server.current
        if (!target) break
        const res = await api.post<ApiResponse<{ reacted: boolean; reaction?: string }>>(
          `/stories/${story._id}/reply`, { reaction: target })
        server.current = res.data.data?.reacted ? res.data.data.reaction : undefined
      }
    } catch {
      // Show what the server actually holds rather than a state it never took.
      want.current = server.current
      setMine(server.current)
    } finally {
      inFlight.current = false
    }
  }, [story._id])

  /** Tapping the same one again takes it back; a different one replaces it. */
  const react = (emoji: string) => {
    const undoing = mine === emoji
    const next = undoing ? undefined : emoji
    touched.current = true
    ;(undoing ? unlikeHaptic : likeHaptic)()
    setMine(next)
    want.current = next
    if (!undoing) {
      setBurst(emoji)
      window.setTimeout(() => setBurst(null), 900)
      onSent('reaction')
    }
    void flush()
  }

  const sendReply = async (content: string) => {
    if (sending) return
    sendHaptic()
    setSending(true)
    try {
      await api.post(`/stories/${story._id}/reply`, { content })
      setText('')
      inputRef.current?.blur()
      onSent('reply')
    } catch { /* the bar stays filled so nothing typed is lost */ }
    finally { setSending(false) }
  }

  const liked = mine === LIKE

  return (
    <div className="relative">
      <AnimatePresence>
        {focused && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="absolute bottom-full inset-x-0 mb-4 grid grid-cols-4 gap-y-4 justify-items-center">
            {STORY_REACTIONS.map(r => (
              <button key={r} onMouseDown={e => e.preventDefault()} onClick={() => react(r)}
                aria-pressed={mine === r}
                className={`text-[34px] leading-none transition-transform hover:scale-125 active:scale-90 ${
                  mine === r ? 'scale-125 drop-shadow-[0_0_10px_rgba(255,255,255,.55)]' : ''}`}
                aria-label={t('stories.reactWith', { emoji: r })}>
                {r}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {burst && (
          <motion.span initial={{ opacity: 0, scale: 0.4, y: 0 }} animate={{ opacity: 1, scale: 2.2, y: -160 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }} className="absolute right-6 bottom-4 text-4xl pointer-events-none">
            {burst}
          </motion.span>
        )}
      </AnimatePresence>
      <form onSubmit={e => { e.preventDefault(); if (text.trim()) sendReply(text.trim()) }} className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onFocus={() => { setFocused(true); onFocusChange(true) }}
          onBlur={() => { setFocused(false); onFocusChange(false) }}
          placeholder={t('stories.replyTo', { name: ownerName })}
          maxLength={1000}
          className="flex-1 h-11 rounded-full bg-transparent border border-white/60 px-4 text-white text-[14px] placeholder:text-white/75 focus:outline-none focus:border-white"
        />
        {/* The like is a like. It stays put whatever else is happening, it is
            always a heart, and the only thing it says is liked or not — the
            other emoji live in the reactions row above. */}
        <button type="button" onClick={() => react(LIKE)} aria-pressed={liked}
          aria-label={t('stories.like')}
          className={`w-11 h-11 flex items-center justify-center press transition-colors ${liked ? 'text-red-500' : 'text-white'}`}>
          <HeartIcon filled={liked} />
        </button>
        {!!text.trim() && (
          <button type="submit" disabled={sending} aria-label={t('stories.send')} className="h-11 pr-1 text-white font-semibold text-[14px] press">
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-6 w-6" />}
          </button>
        )}
      </form>
    </div>
  )
}

function HeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-7 h-7 transition-transform ${filled ? 'scale-110' : ''}`}
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
    </svg>
  )
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <motion.div className="absolute inset-0 bg-black/50 z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} data-no-tap />
      <motion.div data-no-tap
        className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-neutral-900 text-white pb-[env(safe-area-inset-bottom,0px)] max-h-[70%] flex flex-col"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 420, damping: 40 }}>
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mt-2.5 mb-1 flex-shrink-0" />
        {children}
      </motion.div>
    </>
  )
}

interface ViewerRow { user: User; reaction?: string; viewedAt: string }

function ViewersSheet({ storyId, onClose, onOpenProfile }: { storyId: string; onClose: () => void; onOpenProfile: (username: string) => void }) {
  const { t } = useTranslation()
  const [data, setData] = useState<{ viewCount: number; reactionCount: number; viewers: ViewerRow[] } | null>(null)
  useEffect(() => {
    api.get<ApiResponse<{ viewCount: number; reactionCount: number; viewers: ViewerRow[] }>>(`/stories/${storyId}/viewers`)
      .then(r => setData(r.data.data)).catch(() => setData({ viewCount: 0, reactionCount: 0, viewers: [] }))
  }, [storyId])
  const rows = useMemo(() => data?.viewers ?? [], [data])

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pt-2 pb-3 flex items-center gap-4 border-b border-white/10 flex-shrink-0">
        <span className="flex items-center gap-1.5 font-semibold"><Eye className="h-4 w-4" /> {data?.viewCount ?? '–'}</span>
        {!!data?.reactionCount && <span className="text-white/70 text-sm">{t('stories.reactions', { count: data.reactionCount })}</span>}
      </div>
      <div className="overflow-y-auto">
        {!data ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>
        ) : !rows.length ? (
          <p className="py-10 text-center text-white/60 text-sm">{t('stories.noViewers')}</p>
        ) : rows.map(v => (
          <button key={v.user._id} onClick={() => onOpenProfile(v.user.username)} className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 text-left">
            {v.user.avatar ? <img src={v.user.avatar} alt="" className="w-11 h-11 rounded-full object-cover" /> : <span className="w-11 h-11 rounded-full bg-brand-green" />}
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold truncate">{v.user.name}</span>
              <span className="block text-[12.5px] text-white/55 truncate">@{v.user.username} · {shortAgo(v.viewedAt)}</span>
            </span>
            {v.reaction && <span className="text-2xl">{v.reaction}</span>}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
