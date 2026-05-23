import { useState, useRef, useEffect, useCallback } from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMotionValue, useTransform, animate, motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Share2, ShoppingBag, Volume2, VolumeX, Play, Loader2, X, Send, Radio } from 'lucide-react'
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
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const startTimeRef = useRef<number>(0)
  const { user } = useAuthStore()

  const reelUser = reel.userId as unknown as User
  const product = reel.productId as unknown as Product | null

  const viewMutation = useMutation({
    mutationFn: (watchTime: number) => api.post(`/reels/${reel._id}/view`, { watchTime }),
  })

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
          .then(() => { setPlaying(true); startTimeRef.current = Date.now() })
          .catch(() => { setPlaying(false) })
      }

      // If enough data is already buffered, play immediately; otherwise wait
      if (video.readyState >= 3) {
        tryPlay()
      } else {
        setBuffering(true)
        video.addEventListener('canplay', tryPlay, { once: true })
        return () => video.removeEventListener('canplay', tryPlay)
      }
    } else {
      video.pause()
      video.currentTime = 0
      setPlaying(false)
      setBuffering(false)
      setShowComments(false)
      if (startTimeRef.current) {
        viewMutation.mutate(Math.round((Date.now() - startTimeRef.current) / 1000))
        startTimeRef.current = 0
      }
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
    const url = `${window.location.origin}/reels?id=${reel._id}`
    try {
      if (navigator.share) await navigator.share({ title: reel.title, text: reel.caption, url })
      else await navigator.clipboard.writeText(url)
      setShareCount(prev => prev + 1)
      api.post(`/reels/${reel._id}/share`).catch(() => {})
    } catch {}
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) { video.play(); setPlaying(true) }
    else { video.pause(); setPlaying(false) }
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {reel.videoUrl ? (
        <video
          ref={videoRef}
          src={reel.videoUrl}
          loop
          muted={muted}
          playsInline
          preload={isActive ? 'auto' : preloadHint}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ willChange: 'transform' }}
          onClick={togglePlay}
          onPointerDown={e => { if ((e.target as HTMLElement).tagName === 'VIDEO') e.stopPropagation() }}
          onWaiting={() => isActive && setBuffering(true)}
          onPlaying={() => setBuffering(false)}
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
        {isActive && !playing && !buffering && (
          <motion.div key="pause" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center">
              <Play className="h-8 w-8 text-white ml-1" />
            </div>
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
    </div>
  )
}

// ─── Main feed ─────────────────────────────────────────────────────────────────
export default function ReelFeed() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentIndexRef = useRef(0)
  const reelsRef = useRef<Reel[]>([])
  const startYRef = useRef(0)
  const draggingRef = useRef(false)
  const animatingRef = useRef(false)

  const y = useMotionValue(0)
  // Adjacent cards follow y in lockstep so they're always visible during the drag
  const prevCardY = useTransform(y, v => v - window.innerHeight)
  const nextCardY = useTransform(y, v => v + window.innerHeight)

  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['reels'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get<ApiResponse<Reel[]>>(`/reels?page=${pageParam}`)
      return { data: res.data.data ?? [], page: pageParam } as ReelPage
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.data.length === 10 ? last.page + 1 : undefined),
  })

  const reels = data?.pages.flatMap(p => p.data) ?? []
  reelsRef.current = reels

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
    const h = window.innerHeight
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
        setCurrentIndex(targetIndex)
        y.set(0)
        animatingRef.current = false
        if (targetIndex >= rls.length - 3 && hasNextPage) fetchNextPage()
      },
    })
  }, [y, hasNextPage, fetchNextPage])

  const settle = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    const delta = y.get()
    const h = window.innerHeight
    const vel = y.getVelocity()

    if (delta < -h * 0.15 || vel < -300) snapTo(currentIndexRef.current + 1)
    else if (delta > h * 0.15 || vel > 300) snapTo(currentIndexRef.current - 1)
    else animate(y, 0, { type: 'spring', stiffness: 500, damping: 38, velocity: vel })
  }, [y, snapTo])

  // Touch — non-passive touchmove so we can prevent page scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (animatingRef.current) return
      if ((e.target as Element).closest('button, a, input, textarea, [data-no-drag]')) return
      startYRef.current = e.touches[0].clientY
      draggingRef.current = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (animatingRef.current) return
      if ((e.target as Element).closest('button, a, input, textarea, [data-no-drag]')) return
      const delta = e.touches[0].clientY - startYRef.current
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

  // Mouse drag for desktop
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onMouseDown = (e: MouseEvent) => {
      if (animatingRef.current) return
      if ((e.target as Element).closest('button, a, input, textarea, [data-no-drag]')) return
      startYRef.current = e.clientY
      draggingRef.current = false
    }

    const onMouseMove = (e: MouseEvent) => {
      if (animatingRef.current || !e.buttons) return
      const delta = e.clientY - startYRef.current
      if (!draggingRef.current && Math.abs(delta) < 5) return
      draggingRef.current = true
      y.set(delta)
    }

    const onMouseLeave = () => {
      if (!draggingRef.current) return
      const delta = y.get()
      const vel = y.getVelocity()
      if (Math.abs(delta) > window.innerHeight * 0.20 || Math.abs(vel) > 400) settle()
      else {
        draggingRef.current = false
        animate(y, 0, { type: 'spring', stiffness: 500, damping: 38 })
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseup', settle)
    el.addEventListener('mouseleave', onMouseLeave)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseup', settle)
      el.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [settle, y])

  // Wheel — one snap per debounce window
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let lastTime = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = Date.now()
      if (animatingRef.current || now - lastTime < 300) return
      lastTime = now
      if (e.deltaY > 0) snapTo(currentIndexRef.current + 1)
      else snapTo(currentIndexRef.current - 1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [snapTo])

  if (!reels.length) return (
    <div className="h-screen bg-black flex items-center justify-center flex-col gap-4">
      <Play className="h-16 w-16 text-white/10" />
      <p className="text-white/40 text-lg">No reels yet</p>
      <p className="text-white/20 text-sm">Farmers will post short videos here</p>
    </div>
  )

  return (
    <div
      ref={containerRef}
      className="h-screen bg-black overflow-hidden relative select-none"
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

      {/* Go Live — farmers only */}
      {user?.role === 'FARMER' && (
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => navigate('/live')}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-full text-white text-xs font-bold border border-red-400/30 active:scale-95 transition-all shadow-lg"
          >
            <Radio className="h-3.5 w-3.5" />
            Go Live
          </button>
        </div>
      )}

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
