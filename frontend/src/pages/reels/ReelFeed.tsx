import { useState, useRef, useEffect, useCallback } from 'react'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageCircle, Share2, ShoppingBag, Volume2, VolumeX, Play, ChevronUp, ChevronDown } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, Reel, User, Product } from '@/types'

interface ReelPage { data: Reel[]; page: number }

function ReelCard({ reel, isActive }: { reel: Reel; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(reel.likeCount)
  const [playing, setPlaying] = useState(false)
  const startTimeRef = useRef<number>(0)

  const user = reel.userId as unknown as User
  const product = reel.productId as unknown as Product | null

  const viewMutation = useMutation({
    mutationFn: (watchTime: number) => api.post(`/reels/${reel._id}/view`, { watchTime }),
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isActive) {
      video.play().then(() => { setPlaying(true); startTimeRef.current = Date.now() }).catch(() => {})
    } else {
      video.pause()
      video.currentTime = 0
      setPlaying(false)
      if (startTimeRef.current) {
        viewMutation.mutate(Math.round((Date.now() - startTimeRef.current) / 1000))
        startTimeRef.current = 0
      }
    }
  }, [isActive])

  const handleLike = async () => {
    setLiked(prev => !prev)
    setLikeCount(prev => liked ? prev - 1 : prev + 1)
    try {
      await api.post('/social/like', { targetId: reel._id, targetType: 'Reel' })
    } catch {}
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) { video.play(); setPlaying(true) } else { video.pause(); setPlaying(false) }
  }

  return (
    <div className="relative h-full w-full bg-brand-dark overflow-hidden">
      {reel.videoUrl ? (
        <video ref={videoRef} src={reel.videoUrl} loop muted={muted} playsInline
          className="absolute inset-0 w-full h-full object-cover" onClick={togglePlay} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-800 to-brand-dark flex items-center justify-center">
          <Play className="h-20 w-20 text-white/10" />
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

      {/* Play indicator */}
      <AnimatePresence>
        {!playing && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center">
              <Play className="h-8 w-8 text-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right actions */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
        <Avatar src={user?.avatar} name={user?.name ?? 'Farmer'} size="sm" verified={user?.isVerified} />
        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <Heart className={`h-7 w-7 ${liked ? 'fill-red-500 text-red-500' : 'text-white'} transition-colors`} />
          <span className="text-white text-xs">{formatNumber(likeCount)}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <MessageCircle className="h-7 w-7 text-white" />
          <span className="text-white text-xs">{formatNumber(reel.commentCount)}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Share2 className="h-7 w-7 text-white" />
          <span className="text-white text-xs">{formatNumber(reel.shareCount)}</span>
        </button>
        <button onClick={() => setMuted(m => !m)}>
          {muted ? <VolumeX className="h-7 w-7 text-white" /> : <Volume2 className="h-7 w-7 text-white" />}
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-12 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-white">@{user?.username}</span>
          {user?.isVerified && <Badge variant="default" className="text-xs px-1.5 py-0">✓</Badge>}
        </div>
        {reel.caption && <p className="text-white/80 text-sm mb-2 line-clamp-2">{reel.caption}</p>}
        {reel.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {reel.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs text-brand-green">#{tag}</span>
            ))}
          </div>
        )}
        {product && (
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur rounded-xl p-3">
            <div className="h-10 w-10 rounded-lg overflow-hidden bg-brand-700 flex-shrink-0">
              {product.images?.[0] && <img src={product.images[0]} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{product.title}</p>
              <p className="text-brand-green text-xs font-semibold">{formatCurrency(product.price)} {product.priceUnit}</p>
            </div>
            <button className="bg-brand-green text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" /> Buy
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReelFeed() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['reels'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get<ApiResponse<Reel[]>>(`/reels?page=${pageParam}`)
      return { data: res.data.data, page: pageParam } as ReelPage
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.data.length === 10 ? last.page + 1 : undefined),
  })

  const reels = data?.pages.flatMap(p => p.data) ?? []

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= reels.length) return
    setCurrentIndex(index)
    if (index >= reels.length - 3 && hasNextPage) fetchNextPage()
  }, [reels.length, hasNextPage, fetchNextPage])

  // Touch/wheel scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let startY = 0
    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0].clientY }
    const onTouchEnd = (e: TouchEvent) => {
      const delta = startY - e.changedTouches[0].clientY
      if (Math.abs(delta) > 50) goTo(currentIndex + (delta > 0 ? 1 : -1))
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      goTo(currentIndex + (e.deltaY > 0 ? 1 : -1))
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('touchstart', onTouchStart); el.removeEventListener('touchend', onTouchEnd); el.removeEventListener('wheel', onWheel) }
  }, [currentIndex, goTo])

  if (!reels.length) return (
    <div className="h-screen bg-brand-dark flex items-center justify-center flex-col gap-4">
      <Play className="h-16 w-16 text-white/10" />
      <p className="text-white/40">No reels yet</p>
      <p className="text-white/20 text-sm">Farmers will post short videos here</p>
    </div>
  )

  return (
    <div ref={containerRef} className="h-screen bg-black overflow-hidden relative">
      <AnimatePresence initial={false}>
        <motion.div key={currentIndex} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute inset-0">
          <ReelCard reel={reels[currentIndex]} isActive={true} />
        </motion.div>
      </AnimatePresence>

      {/* Nav arrows */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
        <button onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}
          className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white disabled:opacity-30 hover:bg-black/50 transition-colors">
          <ChevronUp className="h-5 w-5" />
        </button>
        <button onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === reels.length - 1}
          className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white disabled:opacity-30 hover:bg-black/50 transition-colors">
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 -translate-x-10 flex flex-col gap-1 z-10">
        {reels.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((_, i) => {
          const isActive = i === Math.min(2, currentIndex)
          return <div key={i} className={`rounded-full transition-all ${isActive ? 'bg-white h-4 w-1' : 'bg-white/30 h-1.5 w-1'}`} />
        })}
      </div>
    </div>
  )
}
