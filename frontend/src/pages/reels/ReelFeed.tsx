import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMotionValue, useTransform, animate, motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { Heart, MessageCircle, Share2, ShoppingBag, Volume2, VolumeX, Play, Loader2, X, Send, Radio, Eye, ChevronUp, ChevronDown, RotateCcw, Bookmark } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { formatCurrency, formatNumber, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { ShareSheet } from '@/components/reels/ShareSheet'
import { CommentsDrawer } from '@/components/reels/CommentsDrawer'
import { patchReelEverywhere } from '@/lib/reelCache'
import { ExpandableText } from '@/components/ui/ExpandableText'
import { BottomNav } from '@/components/layout/BottomNav'
import { CreateSheet } from '@/components/layout/CreateSheet'
import type { ApiResponse, Reel, User, Product } from '@/types'

interface ReelPage { data: Reel[]; nextCursor: string | null }

// ─── Individual reel card ──────────────────────────────────────────────────────
// Every render site below MUST pass `key={reel._id}`. The prev/current/next slots
// are fixed JSX positions, so without a per-reel key React reuses the same
// instance (and the same <video> DOM node) as `reel` changes underneath it —
// the like/comment/share/view counts seeded from `reel.*` below go stale, and
// worse, "current" always renders isActive={true} as a literal constant, so the
// autoplay effect's [isActive] dependency never changes and never re-fires:
// only the very first reel a slot ever holds would autoplay, every reel after
// it would sit fully loaded and paused until manually tapped.
function ReelCard({
  reel, isActive, muted, onMuteToggle, preloadHint = 'metadata', openCommentsOnMount = false,
}: {
  reel: Reel; isActive: boolean; muted: boolean; onMuteToggle: () => void; preloadHint?: 'auto' | 'metadata' | 'none'
  /** Arriving from "View all comments" on a feed post opens them straight away. */
  openCommentsOnMount?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [liked, setLiked] = useState(reel.userLiked ?? false)
  const [likeCount, setLikeCount] = useState(reel.likeCount)
  const [saved, setSaved] = useState(reel.userSaved ?? false)
  const [saveCount, setSaveCount] = useState(reel.saveCount ?? 0)
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([])
  const lastTapRef = useRef(0)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savePendingRef = useRef(false)
  const [shareCount, setShareCount] = useState(reel.shareCount)
  const [commentCount, setCommentCount] = useState(reel.commentCount)
  const [viewCount, setViewCount] = useState(reel.viewCount ?? 0)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [showComments, setShowComments] = useState(openCommentsOnMount)
  const [shareToast, setShareToast] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToastText, setShareToastText] = useState('Link copied')
  const { isAuthenticated: signedIn } = useAuthStore()
  const startTimeRef = useRef<number>(0)
  const viewedRef = useRef(false) // ensure one view per reel mount
  const watchTimeSentRef = useRef(false) // ensure watch-time posts exactly once per reel mount
  const retriedRef = useRef(false) // one automatic retry on video load failure

  const reelUser = reel.userId as unknown as User
  const product = reel.productId as unknown as Product | null

  // Count a view exactly once per reel — fires as soon as it starts playing, so a
  // view is counted even if the user never scrolls away. Watch time itself is
  // reported separately by flushWatchTime() once we know how long they stayed.
  const recordView = () => {
    if (viewedRef.current) return
    viewedRef.current = true
    setViewCount(prev => prev + 1)
  }

  // Reports real elapsed watch time — without this, every view was posted with
  // watchTime: 0, which made the recommendation engine treat every reel view as a
  // near-zero-completion (negative) engagement signal and suppressed reel content
  // platform-wide.
  const flushWatchTime = () => {
    if (watchTimeSentRef.current || !startTimeRef.current) return
    watchTimeSentRef.current = true
    const watchTime = (Date.now() - startTimeRef.current) / 1000
    api.post(`/reels/${reel._id}/view`, { watchTime }).catch(() => {})
  }

  // Sync mute without causing re-play
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = muted
  }, [muted])

  // Auto-play when active; pause + reset when inactive
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isActive) {
      video.muted = muted
      watchTimeSentRef.current = false // a re-watch (scrolled back to this reel) reports its own watch time

      const tryPlay = () => {
        setBuffering(false)
        video.play()
          .then(() => { setPlaying(true); startTimeRef.current = Date.now(); recordView() })
          .catch(() => { setPlaying(false) })
      }

      if (video.readyState >= 3) {
        tryPlay()
      } else {
        setBuffering(true)
        video.addEventListener('canplay', tryPlay, { once: true })
        // Guard against race: video may have become ready between the readyState
        // check above and when the listener was added, so canplay won't re-fire
        if (video.readyState >= 3) {
          video.removeEventListener('canplay', tryPlay)
          tryPlay()
        }
        return () => video.removeEventListener('canplay', tryPlay)
      }
    } else {
      flushWatchTime()
      video.pause()
      video.currentTime = 0
      setPlaying(false)
      setBuffering(false)
      setShowComments(false)
      startTimeRef.current = 0
    }
  }, [isActive]) // intentionally exclude muted — handled by its own effect

  // Reliability fallbacks: report watch time on unmount (navigated away entirely)
  // and on tab close/backgrounding, since neither reliably passes through the
  // isActive-false branch above.
  useEffect(() => {
    return () => flushWatchTime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handlePageHide = () => {
      if (watchTimeSentRef.current || !startTimeRef.current) return
      watchTimeSentRef.current = true
      const watchTime = (Date.now() - startTimeRef.current) / 1000
      navigator.sendBeacon?.(
        `/api/reels/${reel._id}/view`,
        new Blob([JSON.stringify({ watchTime })], { type: 'application/json' })
      )
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (reel.userLiked !== undefined) setLiked(reel.userLiked)
  }, [reel.userLiked])
  useEffect(() => { setSaved(reel.userSaved ?? false) }, [reel.userSaved])
  useEffect(() => { setSaveCount(reel.saveCount ?? 0) }, [reel.saveCount])

  // Resync counters if the underlying query data ever changes underneath this
  // card (e.g. a future refetch/invalidation) — mirrors FeedProductCard's
  // pattern for the same class of "local optimistic count vs. server prop"
  // state, so this card doesn't quietly go stale if that changes.
  useEffect(() => { setLikeCount(reel.likeCount) }, [reel.likeCount])
  useEffect(() => { setShareCount(reel.shareCount) }, [reel.shareCount])
  useEffect(() => { setCommentCount(reel.commentCount) }, [reel.commentCount])
  useEffect(() => { setViewCount(reel.viewCount ?? 0) }, [reel.viewCount])

  const likePendingRef = useRef(false)

  const handleLike = async () => {
    // Ignore rapid double-taps while a toggle is in flight — two overlapping
    // requests can otherwise race the backend's unique-like-per-user index.
    if (likePendingRef.current) return
    likePendingRef.current = true
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount(prev => newLiked ? prev + 1 : prev - 1)
    try {
      await api.post('/social/like', { targetId: reel._id, targetType: 'Reel' })
      patchReelEverywhere(reel._id, r => ({ userLiked: newLiked, likeCount: Math.max(0, (r.likeCount ?? 0) + (newLiked ? 1 : -1)) }))
    } catch {
      setLiked(!newLiked)
      setLikeCount(prev => newLiked ? prev - 1 : prev + 1)
    } finally {
      likePendingRef.current = false
    }
  }

  // Bookmark, as Instagram's save and TikTok's favourites. Shows up in the
  // Saved tab of your own profile.
  const handleSave = async () => {
    if (savePendingRef.current) return
    savePendingRef.current = true
    const next = !saved
    setSaved(next)
    setSaveCount(c => Math.max(0, c + (next ? 1 : -1)))
    try {
      await api.post('/social/save', { targetId: reel._id, targetType: 'Reel' })
      patchReelEverywhere(reel._id, r => ({ userSaved: next, saveCount: Math.max(0, (r.saveCount ?? 0) + (next ? 1 : -1)) }))
    } catch {
      setSaved(!next)
      setSaveCount(c => Math.max(0, c + (next ? -1 : 1)))
    } finally {
      savePendingRef.current = false
    }
  }

  /**
   * Tap to pause, double-tap to like — the gesture both apps have trained
   * everyone to expect. A single tap waits one double-tap window before
   * pausing, so a double-tap never flickers the video off and back on. Like
   * Instagram, double-tap only ever likes; un-liking is the button's job, so a
   * second enthusiastic double-tap cannot take the like away.
   */
  const handleVideoTap = (e: React.MouseEvent) => {
    const now = Date.now()
    if (now - lastTapRef.current < 280) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
      tapTimerRef.current = null
      lastTapRef.current = 0
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const id = now
      setHearts(h => [...h, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }])
      setTimeout(() => setHearts(h => h.filter(x => x.id !== id)), 900)
      if (!liked) void handleLike()
      return
    }
    lastTapRef.current = now
    tapTimerRef.current = setTimeout(() => { tapTimerRef.current = null; togglePlay() }, 280)
  }

  // Signed in: the send-to sheet, so the reel goes to someone's inbox on
  // eMazao. Signed out there is nobody to send to, so fall back to the phone's
  // share sheet or copying the link.
  const openShare = () => {
    if (signedIn) { setShareOpen(true); return }
    void handleShare()
  }

  const onSharedToPeople = (count: number) => {
    setShareCount(prev => prev + count)
    patchReelEverywhere(reel._id, r => ({ shareCount: (r.shareCount ?? 0) + count }))
    setShareToastText(count === 1 ? 'Sent' : `Sent to ${count} people`)
    setShareToast(true)
    setTimeout(() => setShareToast(false), 2000)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/reels/${reel._id}`
    let shared = false

    if (navigator.share) {
      try {
        await navigator.share({ title: reel.title, text: reel.caption ?? '', url })
        shared = true
      } catch (e: any) {
        // AbortError = user cancelled the share sheet — don't count
        if (e?.name !== 'AbortError') shared = await copyToClipboard(url)
      }
    } else {
      shared = await copyToClipboard(url)
    }

    if (shared) {
      setShareCount(prev => prev + 1)
      patchReelEverywhere(reel._id, r => ({ shareCount: (r.shareCount ?? 0) + 1 }))
      setShareToastText('Link copied')
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2000)
      api.post(`/reels/${reel._id}/share`).catch(() => {})
    }
  }

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
      // HTTP fallback: execCommand works without HTTPS
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    } catch {
      return false
    }
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) { video.play(); setPlaying(true) }
    else { video.pause(); setPlaying(false) }
  }

  // Recover from a failed/dead video source: try one silent reload (transient CDN
  // hiccup), then surface a retry button rather than a black screen.
  const handleVideoError = () => {
    const video = videoRef.current
    if (video && !retriedRef.current) {
      retriedRef.current = true
      video.load()
      if (isActive) video.play().catch(() => {})
      return
    }
    setBuffering(false)
    setVideoError(true)
  }

  const retryVideo = () => {
    const video = videoRef.current
    retriedRef.current = false
    setVideoError(false)
    setBuffering(true)
    video?.load()
    video?.play().catch(() => {})
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {reel.videoUrl ? (
        <video
          ref={videoRef}
          src={reel.videoUrl}
          poster={reel.thumbnailUrl}
          loop
          muted={muted}
          playsInline
          preload={isActive ? 'auto' : preloadHint}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ willChange: 'transform' }}
          onClick={handleVideoTap}
          onPointerDown={e => { if ((e.target as HTMLElement).tagName === 'VIDEO') e.stopPropagation() }}
          onWaiting={() => isActive && setBuffering(true)}
          onPlaying={() => { setBuffering(false); setVideoError(false) }}
          onError={handleVideoError}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-green/20 to-black flex items-center justify-center">
          <Play className="h-20 w-20 text-white/10" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

      {/* Overlay: buffering spinner OR paused play button */}
      <AnimatePresence>
        {isActive && buffering && (
          <motion.div key="buf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="h-10 w-10 text-white/70 animate-spin" />
          </motion.div>
        )}
        {isActive && !playing && !buffering && !videoError && (
          <motion.div key="pause" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center">
              <Play className="h-8 w-8 text-white ml-1" />
            </div>
          </motion.div>
        )}
        {videoError && (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50"
            onPointerDown={e => e.stopPropagation()}>
            <p className="text-white/70 text-sm">This video couldn’t load</p>
            <button
              onClick={retryVideo}
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all px-4 py-2 rounded-full text-white text-sm font-medium"
            >
              <RotateCcw className="h-4 w-4" /> Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double-tap hearts */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        <AnimatePresence>
          {hearts.map(h => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, scale: 0.4, rotate: -12 }}
              animate={{ opacity: 1, scale: 1.2, rotate: 0 }}
              exit={{ opacity: 0, scale: 1.5, y: -60 }}
              transition={{ type: 'spring', stiffness: 400, damping: 16 }}
              className="absolute"
              style={{ left: h.x - 48, top: h.y - 48 }}
            >
              <Heart className="h-24 w-24 fill-red-500 text-red-500 drop-shadow-2xl" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Right actions */}
      <div
        className="absolute right-3 lg:right-24 bottom-32 flex flex-col items-center gap-5 z-10"
        onPointerDown={e => e.stopPropagation()}
      >
        <Avatar src={reelUser?.avatar} name={reelUser?.name ?? 'Farmer'} size="sm" verified={reelUser?.isVerified} />

        <motion.button whileTap={{ scale: 1.3 }} onClick={handleLike} className="flex flex-col items-center gap-1">
          <Heart className={`h-7 w-7 transition-colors drop-shadow ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
          <span className="text-white text-xs font-medium">{formatNumber(likeCount)}</span>
        </motion.button>

        <motion.button whileTap={{ scale: 1.1 }} onClick={() => setShowComments(c => !c)}
          className="flex flex-col items-center gap-1">
          <MessageCircle className={`h-7 w-7 text-white drop-shadow ${showComments ? 'fill-white/20' : ''}`} />
          <span className="text-white text-xs font-medium">{formatNumber(commentCount)}</span>
        </motion.button>

        <motion.button whileTap={{ scale: 1.2 }} onClick={handleSave} aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save'} className="flex flex-col items-center gap-1">
          <Bookmark className={`h-7 w-7 transition-colors drop-shadow ${saved ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
          <span className="text-white text-xs font-medium">{formatNumber(saveCount)}</span>
        </motion.button>

        <motion.button whileTap={{ scale: 1.1 }} onClick={openShare} aria-label="Share" className="flex flex-col items-center gap-1">
          <Share2 className="h-7 w-7 text-white drop-shadow" />
          <span className="text-white text-xs font-medium">{formatNumber(shareCount)}</span>
        </motion.button>

        <button onClick={onMuteToggle} className="drop-shadow">
          {muted ? <VolumeX className="h-7 w-7 text-white" /> : <Volume2 className="h-7 w-7 text-white" />}
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-14 lg:right-40 p-4 z-10" onPointerDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-white drop-shadow">@{reelUser?.username}</span>
          {reelUser?.isVerified && <Badge variant="default" className="text-xs px-1.5 py-0">✓</Badge>}
          <span className="flex items-center gap-1 text-white/70 text-xs drop-shadow">
            <Eye className="h-3.5 w-3.5" />{formatNumber(viewCount)}
          </span>
        </div>
        {reel.caption && (
          // Opened, the caption can run long; it scrolls inside the lower part
          // of the video rather than pushing the controls off screen.
          <div className="mb-2 max-h-[40vh] overflow-y-auto no-scrollbar" data-no-drag>
            <ExpandableText className="text-white/90 text-sm drop-shadow" moreClassName="text-white font-semibold drop-shadow">{reel.caption}</ExpandableText>
          </div>
        )}
        {reel.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {reel.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs text-brand-lime drop-shadow">#{tag}</span>
            ))}
          </div>
        )}
        {product && (
          <Link
            to={`/marketplace/product/${(product as any).slug || (product as any)._id}`}
            className="flex items-center gap-3 bg-black/50 backdrop-blur rounded-xl p-3"
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="h-10 w-10 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
              <ImageWithFallback src={(product as any).images?.[0]} alt="" className="w-full h-full object-cover" fallbackClassName="w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{(product as any).title}</p>
              <p className="text-brand-green text-xs font-semibold">{formatCurrency((product as any).price)} {(product as any).priceUnit}</p>
            </div>
            <span className="bg-brand-green text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 flex-shrink-0">
              <ShoppingBag className="h-3 w-3" /> Buy
            </span>
          </Link>
        )}
      </div>

      <AnimatePresence>
        {showComments && (
          <CommentsDrawer
            reelId={reel._id}
            reelOwnerId={reelUser?._id}
            count={commentCount}
            onClose={() => setShowComments(false)}
            onCountChange={d => {
              setCommentCount(n => Math.max(0, n + d))
              patchReelEverywhere(reel._id, r => ({ commentCount: Math.max(0, (r.commentCount ?? 0) + d) }))
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareOpen && (
          <ShareSheet reelId={reel._id} onClose={() => setShareOpen(false)} onShared={onSharedToPeople} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm text-white text-sm px-5 py-2 rounded-full z-30 pointer-events-none whitespace-nowrap"
          >
            {shareToastText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main feed ─────────────────────────────────────────────────────────────────
export default function ReelFeed() {
  const navigate = useNavigate()
  const { reelId } = useParams()
  const location = useLocation()
  // When arriving from the feed we get the reel object via router state (instant,
  // no flash). On a direct/refreshed URL we fetch it by id so it still opens here.
  const stateReel = (location.state as { reel?: Reel } | null)?.reel
  const openComments = !!(location.state as { openComments?: boolean } | null)?.openComments
  const { user } = useAuthStore()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentIndexRef = useRef(0)
  const reelsRef = useRef<Reel[]>([])
  const startYRef = useRef(0)
  const draggingRef = useRef(false)
  const animatingRef = useRef(false)
  const springBackRef = useRef<{ stop: () => void } | null>(null)
  const touchVelRef = useRef(0)  // px/ms, tracked in onTouchMove before the 5px gate
  const lastTouchRef = useRef({ y: 0, t: 0 })
  // Actual rendered height of the reel viewport. Using window.innerHeight caused
  // the next reel to peek on mobile because CSS 100vh ≠ window.innerHeight when the
  // browser chrome is visible. We measure the container and translate by exactly that.
  const heightRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 0)

  const y = useMotionValue(0)
  // Adjacent cards follow y in lockstep so they're always visible during the drag
  const prevCardY = useTransform(y, v => v - heightRef.current)
  const nextCardY = useTransform(y, v => v + heightRef.current)

  // Used to signal useLayoutEffect to reset y after a state-driven index change
  const pendingYReset = useRef(false)

  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['reels'],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const res = await api.get<ApiResponse<Reel[]> & { nextCursor: string | null }>(
        `/reels${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`
      )
      return { data: res.data.data ?? [], nextCursor: res.data.nextCursor } as ReelPage
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })

  // Fetch the specifically-requested reel (only when we don't already have it from state)
  const { data: fetchedReel } = useQuery({
    queryKey: ['reel', reelId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Reel>>(`/reels/${reelId}`)
      return res.data.data ?? null
    },
    enabled: !!reelId && !stateReel,
  })

  const leadReel = stateReel ?? fetchedReel ?? null
  const feedReels = useMemo(() => data?.pages.flatMap(p => p.data) ?? [], [data])

  // Put the requested reel first, then the rest of the feed (de-duplicated). While a
  // direct-link reel is still loading, keep the list empty so we don't briefly show
  // the wrong reel at index 0 and then jump.
  const reels = useMemo(() => {
    if (leadReel) return [leadReel, ...feedReels.filter(r => r._id !== leadReel._id)]
    return reelId ? [] : feedReels
  }, [leadReel, feedReels, reelId])
  reelsRef.current = reels

  // Keep the measured viewport height in sync (mobile chrome show/hide, rotation)
  useLayoutEffect(() => {
    const measure = () => { heightRef.current = containerRef.current?.clientHeight || window.innerHeight }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])

  // Reset y to 0 AFTER React has committed the new currentIndex to the DOM,
  // so both changes land in the same browser paint — eliminates the blink.
  useLayoutEffect(() => {
    if (pendingYReset.current) {
      pendingYReset.current = false
      y.set(0)
      animatingRef.current = false
    }
  }, [currentIndex, y])

  const snapTo = useCallback((targetIndex: number) => {
    if (animatingRef.current) return
    const currentIdx = currentIndexRef.current
    const rls = reelsRef.current

    if (targetIndex < 0 || targetIndex >= rls.length) {
      // Elastic bounce back
      animate(y, 0, { type: 'spring', stiffness: 500, damping: 40 })
      return
    }

    animatingRef.current = true
    const h = heightRef.current || window.innerHeight
    const targetY = targetIndex > currentIdx ? -h : h
    const currentVel = y.getVelocity()

    animate(y, targetY, {
      type: 'spring',
      stiffness: 550,
      damping: 48,
      mass: 0.85,
      velocity: currentVel, // carry through finger velocity for natural feel
      onComplete: () => {
        currentIndexRef.current = targetIndex
        pendingYReset.current = true
        setCurrentIndex(targetIndex)  // triggers re-render; useLayoutEffect resets y after paint
        if (targetIndex >= rls.length - 3 && hasNextPage) fetchNextPage()
      },
    })
  }, [y, hasNextPage, fetchNextPage])

  const settle = useCallback(() => {
    if (animatingRef.current) return
    const wasDragging = draggingRef.current
    draggingRef.current = false
    const delta = y.get()
    const h = heightRef.current || window.innerHeight
    const vel = y.getVelocity()
    // Fast flicks may not move y at all (< 5px threshold), so fall back to raw touch velocity
    const effectiveVel = Math.abs(vel) >= 1 ? vel : touchVelRef.current * 1000
    touchVelRef.current = 0

    if (delta < -h * 0.15 || effectiveVel < -300) snapTo(currentIndexRef.current + 1)
    else if (delta > h * 0.15 || effectiveVel > 300) snapTo(currentIndexRef.current - 1)
    else if (wasDragging) {
      springBackRef.current = animate(y, 0, { type: 'spring', stiffness: 500, damping: 38, velocity: vel })
    }
  }, [y, snapTo])

  // Touch — non-passive touchmove so we can prevent page scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      // Cancel any in-progress spring-back so it doesn't fight with the new touch
      springBackRef.current?.stop()
      springBackRef.current = null
      if (animatingRef.current) return
      if ((e.target as Element).closest('button, a, input, textarea, [data-no-drag]')) return
      startYRef.current = e.touches[0].clientY
      lastTouchRef.current = { y: e.touches[0].clientY, t: Date.now() }
      touchVelRef.current = 0
      draggingRef.current = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (animatingRef.current) return
      if ((e.target as Element).closest('button, a, input, textarea, [data-no-drag]')) return
      const currentY = e.touches[0].clientY
      const now = Date.now()
      // Track raw velocity before the 5px gate so fast flicks are captured
      const dt = now - lastTouchRef.current.t
      if (dt > 0) touchVelRef.current = (currentY - lastTouchRef.current.y) / dt
      lastTouchRef.current = { y: currentY, t: now }
      const delta = currentY - startYRef.current
      if (!draggingRef.current && Math.abs(delta) < 5) return
      draggingRef.current = true
      e.preventDefault()
      y.set(delta)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', settle)
    el.addEventListener('touchcancel', settle)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', settle)
      el.removeEventListener('touchcancel', settle)
    }
  }, [settle, y])

  // Desktop uses wheel + arrow buttons + keyboard instead of click-drag, which felt
  // jittery (a click to play/pause could turn into an accidental drag).

  // Wheel — one snap per gesture. Debounced and gated by a small deltaY threshold so
  // a single trackpad swipe (which fires many events) advances exactly one reel.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let lastTime = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (Math.abs(e.deltaY) < 8) return
      const now = Date.now()
      if (animatingRef.current || now - lastTime < 380) return
      lastTime = now
      if (e.deltaY > 0) snapTo(currentIndexRef.current + 1)
      else snapTo(currentIndexRef.current - 1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [snapTo])

  // Where "close" goes. Reels are public so people arrive here from a shared
  // link with no session; sending them to /feed would bounce them straight to
  // the login wall. Signed-out visitors land in the marketplace instead — still
  // public, and the natural next step after watching someone's produce.
  // Back to wherever you came from when that was inside the app; a fresh tab
  // or shared link has nothing to go back to, so it gets a sensible home.
  // Reels is black edge to edge. The page behind it is white in light mode, so
  // on a real phone any sliver the player did not cover (the browser's toolbar
  // sliding in and out, rounding, older browsers without dvh) showed as a white
  // strip at the bottom. Paint the page and the browser's own bar black while
  // Reels is open, and put them back after.
  useEffect(() => {
    const html = document.documentElement, body = document.body
    const meta = document.querySelector('meta[name="theme-color"]')
    const prev = { html: html.style.backgroundColor, body: body.style.backgroundColor, meta: meta?.getAttribute('content') }
    html.style.backgroundColor = '#000'
    body.style.backgroundColor = '#000'
    meta?.setAttribute('content', '#000000')
    return () => {
      html.style.backgroundColor = prev.html
      body.style.backgroundColor = prev.body
      if (prev.meta) meta?.setAttribute('content', prev.meta)
    }
  }, [])

  const exitReels = useCallback(() => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(user ? '/feed' : '/marketplace')
  }, [navigate, user])

  // One exit control for every state of the player — loading and empty screens
  // used to have none, which left a phone user with no way out at all. Offset
  // by the safe-area inset so it never sits under a notch or status bar.
  const exitButton = (
    <button
      onClick={exitReels}
      aria-label="Close reels"
      title="Close (Esc)"
      className="flex items-center justify-center h-10 w-10 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white shadow-lg hover:bg-black/65 active:scale-90 transition-all"
    >
      <X className="h-5 w-5" strokeWidth={2.5} />
    </button>
  )
  const exitPosition = 'absolute left-3 z-30 top-[calc(env(safe-area-inset-top,0px)+12px)]'

  // Keyboard navigation (PC)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); snapTo(currentIndexRef.current + 1) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); snapTo(currentIndexRef.current - 1) }
      if (e.key === 'Escape')    exitReels()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [snapTo, exitReels])

  // Waiting on a direct-linked reel to load — show a spinner, not the empty state
  if (reelId && !leadReel && !reels.length) return (
    <div className="h-[calc(100vh-56px-env(safe-area-inset-bottom,0px))] supports-[height:100dvh]:h-[calc(100dvh-56px-env(safe-area-inset-bottom,0px))] lg:h-screen lg:supports-[height:100dvh]:h-[100dvh] bg-black flex items-center justify-center relative">
      <div className={exitPosition}>{exitButton}</div>
      <Loader2 className="h-10 w-10 text-white/40 animate-spin" />
      <BottomNav variant="dark" />
      <CreateSheet />
    </div>
  )

  if (!reels.length) return (
    <div className="h-[calc(100vh-56px-env(safe-area-inset-bottom,0px))] supports-[height:100dvh]:h-[calc(100dvh-56px-env(safe-area-inset-bottom,0px))] lg:h-screen lg:supports-[height:100dvh]:h-[100dvh] bg-black flex items-center justify-center flex-col gap-4 relative">
      <div className={exitPosition}>{exitButton}</div>
      <Play className="h-16 w-16 text-white/10" />
      <p className="text-white/40 text-lg">No reels yet</p>
      <p className="text-white/20 text-sm">Farmers will post short videos here</p>
      <BottomNav variant="dark" />
      <CreateSheet />
    </div>
  )

  return (
    <>
    <div
      ref={containerRef}
      className="h-[calc(100vh-56px-env(safe-area-inset-bottom,0px))] supports-[height:100dvh]:h-[calc(100dvh-56px-env(safe-area-inset-bottom,0px))] lg:h-screen lg:supports-[height:100dvh]:h-[100dvh] bg-black overflow-hidden relative select-none"
      style={{ willChange: 'transform' }}
    >
      {/* Previous card */}
      {currentIndex > 0 && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ y: prevCardY, willChange: 'transform' }}
        >
          <ReelCard
            key={reels[currentIndex - 1]._id}
            reel={reels[currentIndex - 1]}
            isActive={false}
            muted={muted}
            onMuteToggle={() => {}}
            preloadHint="metadata"
          />
        </motion.div>
      )}

      {/* Current card */}
      <motion.div
        className="absolute inset-0"
        style={{ y, willChange: 'transform' }}
      >
        <ReelCard
          key={reels[currentIndex]._id}
          reel={reels[currentIndex]}
          isActive={true}
          openCommentsOnMount={openComments && currentIndex === 0 && reels[0]?._id === reelId}
          muted={muted}
          onMuteToggle={() => setMuted(m => !m)}
          preloadHint="auto"
        />
      </motion.div>

      {/* Next card — preload auto so it's ready before they swipe */}
      {currentIndex < reels.length - 1 && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ y: nextCardY, willChange: 'transform' }}
        >
          <ReelCard
            key={reels[currentIndex + 1]._id}
            reel={reels[currentIndex + 1]}
            isActive={false}
            muted={muted}
            onMuteToggle={() => {}}
            preloadHint="auto"
          />
        </motion.div>
      )}

      {/* Top-left: close + Go Live (farmers)
          Shown at every width. This was `hidden lg:flex`, so on a tablet — which
          has no swipe-back gesture and no bottom nav on this fullscreen route —
          there was no way out of the reel player at all short of the browser's
          back button. Deliberately quiet: an icon that sits at low opacity over
          the video and only firms up on hover, so it never competes with the
          content. Esc still works and is surfaced via the tooltip. */}
      <div className={`${exitPosition} flex items-center gap-2`}>
        {exitButton}
        {user?.role === 'FARMER' && (
          <button
            onClick={() => navigate('/live')}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-full text-white text-xs font-bold border border-red-400/30 active:scale-95 transition-all shadow-lg"
          >
            <Radio className="h-3.5 w-3.5" />
            Go Live
          </button>
        )}
      </div>

      {/* Desktop navigation arrows — click to move between reels (no janky drag) */}
      <div className="hidden lg:flex flex-col gap-3 absolute right-6 top-1/2 -translate-y-1/2 z-20">
        <button
          onClick={() => snapTo(currentIndexRef.current - 1)}
          disabled={currentIndex === 0}
          aria-label="Previous reel"
          className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/70 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          onClick={() => snapTo(currentIndexRef.current + 1)}
          disabled={currentIndex >= reels.length - 1}
          aria-label="Next reel"
          className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/70 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="absolute right-2 bottom-28 flex flex-col gap-1 z-10 pointer-events-none">
        {reels.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((_, i) => {
          const isActive = i === Math.min(2, currentIndex)
          return (
            <div key={i} className={`rounded-full transition-all duration-300 ${isActive ? 'bg-white h-4 w-1' : 'bg-white/30 h-1.5 w-1'}`} />
          )
        })}
      </div>
    </div>
    {/* TikTok keeps its tab bar under the player; so do we, which also means
        there is always a way out of Reels on a phone. */}
    <BottomNav variant="dark" />
    <CreateSheet />
    </>
  )
}
