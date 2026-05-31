import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMotionValue, useTransform, animate, motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { Heart, MessageCircle, Share2, ShoppingBag, Volume2, VolumeX, Play, Loader2, X, Send, Radio, ArrowLeft, Eye, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, Reel, User, Product } from '@/types'

interface ReelPage { data: Reel[]; page: number }
interface CommentData { _id: string; userId: User; content: string; likeCount: number; createdAt: string }

// ─── Comments drawer ───────────────────────────────────────────────────────────
function CommentsDrawer({
  reelId, count, onClose, onCommentAdded,
}: {
  reelId: string; count: number; onClose: () => void; onCommentAdded: () => void
}) {
  const { user } = useAuthStore()
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const { data: comments, isLoading } = useQuery({
    queryKey: ['reel-comments', reelId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CommentData[]>>(`/reels/${reelId}/comments`)
      return (res.data.data ?? []).filter(Boolean) as CommentData[]
    },
  })

  const postMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post<ApiResponse<CommentData>>(`/reels/${reelId}/comments`, { content })
      return res.data.data
    },
    onSuccess: (comment) => {
      if (!comment) return
      queryClient.setQueryData(['reel-comments', reelId], (old: CommentData[] = []) =>
        [comment, ...old.filter(c => c && c._id !== comment._id)]
      )
      onCommentAdded()
      setText('')
    },
  })

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute inset-x-0 bottom-0 bg-[#111827]/97 backdrop-blur-xl rounded-t-3xl z-30 flex flex-col"
      style={{ maxHeight: '70%' }}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <h3 className="font-semibold text-white">{formatNumber(count)} Comments</h3>
        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {isLoading ? (
          <div className="text-center text-white/30 text-sm py-8">Loading...</div>
        ) : !comments?.length ? (
          <div className="text-center text-white/30 text-sm py-8">No comments yet. Be the first!</div>
        ) : comments.filter(c => c?._id).map(c => {
          const author = c.userId as unknown as { name?: string; username?: string; avatar?: string } | null
          return (
            <div key={c._id} className="flex items-start gap-3">
              <Avatar src={author?.avatar} name={author?.name} size="xs" />
              <div className="flex-1">
                <p className="text-white/80 text-xs font-semibold mb-0.5">@{author?.username ?? 'user'}</p>
                <p className="text-white text-sm leading-relaxed">{c.content}</p>
                <p className="text-white/30 text-xs mt-1">{c.createdAt ? timeAgo(c.createdAt) : ''}</p>
              </div>
            </div>
          )
        })}
      </div>

      {user && (
        <div className="px-4 py-3 border-t border-white/10 flex items-center gap-3">
          <Avatar src={user.avatar} name={user.name} size="xs" />
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && text.trim() && postMutation.mutate(text.trim())}
            placeholder="Add a comment..."
            className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:bg-white/15"
          />
          <button
            onClick={() => text.trim() && postMutation.mutate(text.trim())}
            disabled={!text.trim() || postMutation.isPending}
            className="w-8 h-8 rounded-full bg-brand-green flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Individual reel card ──────────────────────────────────────────────────────
function ReelCard({
  reel, isActive, muted, onMuteToggle, preloadHint = 'metadata',
}: {
  reel: Reel; isActive: boolean; muted: boolean; onMuteToggle: () => void; preloadHint?: 'auto' | 'metadata' | 'none'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [liked, setLiked] = useState(reel.userLiked ?? false)
  const [likeCount, setLikeCount] = useState(reel.likeCount)
  const [shareCount, setShareCount] = useState(reel.shareCount)
  const [commentCount, setCommentCount] = useState(reel.commentCount)
  const [viewCount, setViewCount] = useState(reel.viewCount ?? 0)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [shareToast, setShareToast] = useState(false)
  const startTimeRef = useRef<number>(0)
  const viewedRef = useRef(false) // ensure one view per reel mount
  const retriedRef = useRef(false) // one automatic retry on video load failure
  const { user } = useAuthStore()

  const reelUser = reel.userId as unknown as User
  const product = reel.productId as unknown as Product | null

  // Record a view exactly once per reel — fires as soon as it starts playing,
  // so a view is counted even if the user never scrolls away.
  const recordView = () => {
    if (viewedRef.current) return
    viewedRef.current = true
    setViewCount(prev => prev + 1)
    api.post(`/reels/${reel._id}/view`, { watchTime: 0 }).catch(() => {})
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
      video.pause()
      video.currentTime = 0
      setPlaying(false)
      setBuffering(false)
      setShowComments(false)
      startTimeRef.current = 0
    }
  }, [isActive]) // intentionally exclude muted — handled by its own effect

  useEffect(() => {
    if (reel.userLiked !== undefined) setLiked(reel.userLiked)
  }, [reel.userLiked])

  const handleLike = async () => {
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount(prev => newLiked ? prev + 1 : prev - 1)
    try { await api.post('/social/like', { targetId: reel._id, targetType: 'Reel' }) } catch {
      setLiked(!newLiked)
      setLikeCount(prev => newLiked ? prev - 1 : prev + 1)
    }
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
          onClick={togglePlay}
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

      {/* Right actions */}
      <div
        className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-10"
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

        <motion.button whileTap={{ scale: 1.1 }} onClick={handleShare} className="flex flex-col items-center gap-1">
          <Share2 className="h-7 w-7 text-white drop-shadow" />
          <span className="text-white text-xs font-medium">{formatNumber(shareCount)}</span>
        </motion.button>

        <button onClick={onMuteToggle} className="drop-shadow">
          {muted ? <VolumeX className="h-7 w-7 text-white" /> : <Volume2 className="h-7 w-7 text-white" />}
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-14 p-4 z-10" onPointerDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-white drop-shadow">@{reelUser?.username}</span>
          {reelUser?.isVerified && <Badge variant="default" className="text-xs px-1.5 py-0">✓</Badge>}
          <span className="flex items-center gap-1 text-white/70 text-xs drop-shadow">
            <Eye className="h-3.5 w-3.5" />{formatNumber(viewCount)}
          </span>
        </div>
        {reel.caption && <p className="text-white/80 text-sm mb-2 line-clamp-2 drop-shadow">{reel.caption}</p>}
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
              {(product as any).images?.[0] && <img src={(product as any).images[0]} alt="" className="w-full h-full object-cover" />}
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
            count={commentCount}
            onClose={() => setShowComments(false)}
            onCommentAdded={() => setCommentCount(n => n + 1)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm text-white text-sm px-5 py-2 rounded-full z-30 pointer-events-none whitespace-nowrap"
          >
            Link copied!
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
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get<ApiResponse<Reel[]>>(`/reels?page=${pageParam}`)
      return { data: res.data.data ?? [], page: pageParam } as ReelPage
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.data.length === 10 ? last.page + 1 : undefined),
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

  // Keyboard navigation (PC)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); snapTo(currentIndexRef.current + 1) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); snapTo(currentIndexRef.current - 1) }
      if (e.key === 'Escape')    navigate('/feed')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [snapTo, navigate])

  // Waiting on a direct-linked reel to load — show a spinner, not the empty state
  if (reelId && !leadReel && !reels.length) return (
    <div className="h-[100dvh] bg-black flex items-center justify-center">
      <Loader2 className="h-10 w-10 text-white/40 animate-spin" />
    </div>
  )

  if (!reels.length) return (
    <div className="h-[100dvh] bg-black flex items-center justify-center flex-col gap-4">
      <Play className="h-16 w-16 text-white/10" />
      <p className="text-white/40 text-lg">No reels yet</p>
      <p className="text-white/20 text-sm">Farmers will post short videos here</p>
    </div>
  )

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] bg-black overflow-hidden relative select-none"
      style={{ willChange: 'transform' }}
    >
      {/* Previous card */}
      {currentIndex > 0 && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ y: prevCardY, willChange: 'transform' }}
        >
          <ReelCard
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
          reel={reels[currentIndex]}
          isActive={true}
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
            reel={reels[currentIndex + 1]}
            isActive={false}
            muted={muted}
            onMuteToggle={() => {}}
            preloadHint="auto"
          />
        </motion.div>
      )}

      {/* Top-left: exit (desktop) + Go Live (farmers) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <button
          onClick={() => navigate('/feed')}
          className="hidden lg:flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium border border-white/10 hover:bg-black/70 active:scale-95 transition-all"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Exit
        </button>
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

      {/* Mute toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setMuted(m => !m)}
          className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium border border-white/10 active:scale-95 transition-transform"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          {muted ? 'Sound off' : 'Sound on'}
        </button>
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
  )
}
