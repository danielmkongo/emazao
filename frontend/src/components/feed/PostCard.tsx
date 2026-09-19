import { memo, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Heart, MessageCircle, Send, Bookmark, ShoppingBag, Check, Loader2, Leaf, Star, Volume2, VolumeX, Play, MapPin } from 'lucide-react'
import { ShareSheet } from '@/components/reels/ShareSheet'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { ReelThumb } from '@/components/reels/ReelThumb'
import { StoryAvatar } from '@/components/stories/StoryAvatar'
import { shortAgo } from '@/components/stories/StoryViewer'
import { useCart } from '@/hooks/useCart'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import api from '@/lib/api'
import type { StoryGroup } from '@/lib/stories'
import type { Product, Reel, User } from '@/types'

type TaggedProduct = { _id: string; title: string; price: number; priceUnit: string; images?: string[]; slug?: string }

interface PostCardProps {
  kind: 'PRODUCT' | 'REEL'
  item: Product | Reel
  /** The author's stories, if any, so their avatar can carry the ring. */
  storyGroup?: StoryGroup | null
}

function Verified() {
  return (
    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] flex-shrink-0" aria-label="Verified">
      <path fill="#16A34A" d="M12 1.5l2.6 1.9 3.2-.2 1 3.1 2.7 1.8-1 3.1 1 3.1-2.7 1.8-1 3.1-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3.1-2.7-1.8 1-3.1-1-3.1 2.7-1.8 1-3.1 3.2.2z" />
      <path fill="#fff" d="M10.6 15.6l-3.3-3.3 1.4-1.4 1.9 1.9 4.6-4.6 1.4 1.4z" />
    </svg>
  )
}

/**
 * A post in the home feed, laid out the way Instagram taught everyone to read
 * one — who, the picture, what you can do, what it says — with one addition
 * Instagram keeps behind a tap: the price and a button to buy, right there.
 */
export const PostCard = memo(function PostCard({ kind, item, storyGroup }: PostCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated, user: me } = useAuthStore()
  const isReel = kind === 'REEL'
  const product = isReel ? null : (item as Product)
  const reel = isReel ? (item as Reel) : null
  const author = (isReel ? reel!.userId : product!.sellerId) as User | undefined
  const tagged: TaggedProduct | null = isReel
    ? (typeof reel!.productId === 'object' && reel!.productId ? reel!.productId as unknown as TaggedProduct : null)
    : product

  const href = isReel ? `/reels/${reel!._id}` : `/marketplace/product/${product!.slug || product!._id}`
  const productHref = tagged ? `/marketplace/product/${tagged.slug || tagged._id}` : href

  // ─── Like / save, optimistic with server truth winning on refetch ────────
  const [liked, setLiked] = useState(!!item.userLiked)
  const [likes, setLikes] = useState(item.likeCount ?? 0)
  const [saved, setSaved] = useState(!!item.userSaved)
  useEffect(() => { setLiked(!!item.userLiked) }, [item.userLiked])
  useEffect(() => { setLikes(item.likeCount ?? 0) }, [item.likeCount])
  useEffect(() => { setSaved(!!item.userSaved) }, [item.userSaved])
  const pending = useRef({ like: false, save: false })

  const requireAuth = () => { if (!isAuthenticated) { navigate('/login'); return false } return true }

  const toggleLike = async (force?: boolean) => {
    if (!requireAuth() || pending.current.like) return
    const next = force ?? !liked
    if (next === liked) return
    pending.current.like = true
    setLiked(next); setLikes(c => c + (next ? 1 : -1))
    try { await api.post('/social/like', { targetId: item._id, targetType: isReel ? 'Reel' : 'Product' }) }
    catch { setLiked(!next); setLikes(c => c + (next ? -1 : 1)) }
    finally { pending.current.like = false }
  }

  const toggleSave = async () => {
    if (!requireAuth() || pending.current.save) return
    pending.current.save = true
    const next = !saved
    setSaved(next)
    try { await api.post('/social/save', { targetId: item._id, targetType: isReel ? 'Reel' : 'Product' }) }
    catch { setSaved(!next) }
    finally { pending.current.save = false }
  }

  // ─── Double-tap to like, with the heart where your finger was ───────────
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([])
  const lastTap = useRef(0)
  const singleTapTimer = useRef<number>()
  const onMediaTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now()
    const rect = e.currentTarget.getBoundingClientRect()
    if (now - lastTap.current < 280) {
      window.clearTimeout(singleTapTimer.current)
      lastTap.current = 0
      const id = now
      setHearts(h => [...h, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }])
      window.setTimeout(() => setHearts(h => h.filter(x => x.id !== id)), 900)
      void toggleLike(true)
      return
    }
    lastTap.current = now
    // A single tap opens the post, but only once we know it was not the first
    // half of a double tap.
    singleTapTimer.current = window.setTimeout(() => navigate(href, isReel ? { state: { reel } } : undefined), 280)
  }

  // ─── Reels play inline, muted, while they are mostly on screen ──────────
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const v = videoRef.current
    if (!v || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio >= 0.65) {
        v.preload = 'auto'
        v.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
      } else { v.pause(); setPlaying(false) }
    }, { threshold: [0, 0.65, 1] })
    io.observe(v)
    return () => io.disconnect()
  }, [])

  // ─── Images: swipe through several ──────────────────────────────────────
  const images = product?.images?.length ? product.images : []
  const [slide, setSlide] = useState(0)
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setSlide(Math.round(el.scrollLeft / el.clientWidth))
  }

  // ─── Cart ───────────────────────────────────────────────────────────────
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const isOwn = !!me && author?._id === me._id
  const addToCart = async () => {
    if (!requireAuth() || !tagged) return
    try {
      await add.mutateAsync({ productId: tagged._id })
      setAdded(true)
      window.setTimeout(() => setAdded(false), 2200)
    } catch { navigate(productHref) }
  }

  const [sharing, setSharing] = useState(false)
  const shareProduct = async () => {
    const url = `${window.location.origin}${href}`
    try {
      if (navigator.share) await navigator.share({ title: product?.title, url })
      else { await navigator.clipboard.writeText(url) }
    } catch { /* dismissed */ }
  }

  const askSeller = () => {
    if (!requireAuth() || !author) return
    navigate(`/messages/new?recipientId=${author._id}`, { state: { recipient: author } })
  }

  const place = [author?.region, author?.country].filter(Boolean).join(', ')
  const caption = isReel ? (reel!.caption || reel!.title) : product!.description

  return (
    <article className="bg-[var(--c-bg)] md:border md:border-[var(--c-border)] md:rounded-2xl md:overflow-hidden md:bg-[var(--c-card)]">
      {/* Who */}
      <header className="flex items-center gap-3 px-3.5 py-2.5">
        {author && (
          <StoryAvatar user={author} size={34} group={storyGroup} onNoStory={() => navigate(`/profile/${author.username}`)} />
        )}
        <div className="flex-1 min-w-0 leading-tight">
          <div className="flex items-center gap-1 min-w-0">
            <Link to={author ? `/profile/${author.username}` : '#'} className="text-[14px] font-semibold text-[var(--c-text)] truncate hover:opacity-70">
              {author?.username ?? author?.name}
            </Link>
            {author?.isVerified && <Verified />}
            <span className="text-[var(--c-text-3)] text-[14px] flex-shrink-0">· {shortAgo(item.createdAt)}</span>
          </div>
          <p className="text-[12px] text-[var(--c-text-3)] truncate flex items-center gap-1">
            {product?.isBoosted ? t('feed.sponsored') : place ? <><MapPin className="h-3 w-3" />{place}</> : author?.name}
          </p>
        </div>
      </header>

      {/* The picture */}
      <div className="relative aspect-[4/5] bg-[var(--c-input)] overflow-hidden md:mx-0 select-none cursor-pointer" onClick={onMediaTap}>
        {isReel ? (
          <>
            <video
              ref={videoRef}
              src={reel!.videoUrl}
              muted={muted}
              loop
              playsInline
              preload="none"
              className="w-full h-full object-cover"
            />
            {!playing && (
              <ReelThumb thumbnailUrl={reel!.thumbnailUrl} videoUrl={reel!.videoUrl} className="absolute inset-0 w-full h-full" />
            )}
            {!playing && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-16 h-16 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
                  <Play className="h-7 w-7 text-white fill-white ml-1" />
                </span>
              </span>
            )}
            <button
              onClick={e => { e.stopPropagation(); setMuted(m => !m) }}
              aria-label={muted ? t('stories.unmute') : t('stories.mute')}
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center press"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <span className="absolute top-3 right-3 flex items-center gap-1 text-white text-[12px] font-semibold drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] pointer-events-none">
              <Play className="h-3.5 w-3.5 fill-white" /> {formatNumber(reel!.viewCount ?? 0)}
            </span>
          </>
        ) : images.length ? (
          <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar" onScroll={onScroll}>
            {images.map((src, i) => (
              <div key={src + i} className="w-full h-full flex-shrink-0 snap-center">
                <ImageWithFallback src={src} alt={i === 0 ? product!.title : ''} loading={i === 0 ? 'eager' : 'lazy'}
                  className="w-full h-full object-cover" fallbackClassName="w-full h-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-green/15 to-harvest/10">
            <Leaf className="h-14 w-14 text-brand-green/40" />
          </div>
        )}

        {product?.isOrganic && (
          <span className="absolute top-3 left-3 flex items-center gap-1 text-[11px] font-bold bg-white/90 text-brand-green px-2 py-1 rounded-full backdrop-blur pointer-events-none">
            <Leaf className="h-3 w-3" /> {t('feed.organic')}
          </span>
        )}
        {images.length > 1 && (
          <span className="absolute top-3 right-3 text-[11.5px] font-semibold bg-black/55 text-white px-2 py-0.5 rounded-full pointer-events-none tabular">
            {slide + 1}/{images.length}
          </span>
        )}

        <AnimatePresence>
          {hearts.map(h => (
            <motion.span key={h.id} className="absolute pointer-events-none" style={{ left: h.x - 48, top: h.y - 48 }}
              initial={{ scale: 0, opacity: 0, rotate: -12 }} animate={{ scale: [0, 1.25, 1], opacity: [0, 1, 1], rotate: [-12, 6, 0] }}
              exit={{ scale: 1.4, opacity: 0, y: -40 }} transition={{ duration: 0.45 }}>
              <Heart className="w-24 h-24 text-white fill-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]" />
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* The shop strip: what it is, what it costs, one tap to the cart */}
      {tagged && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-[var(--c-border-sub)] bg-[var(--c-raised)]/40">
          <Link to={productHref} className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-[var(--c-text)] truncate">{tagged.title}</p>
            <p className="text-[13px] text-[var(--c-text-2)] tabular">
              <span className="font-bold text-[var(--c-text)]">{formatCurrency(tagged.price)}</span>
              <span className="text-[var(--c-text-3)]"> / {tagged.priceUnit}</span>
              {!!product?.rating && product.ratingCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-[var(--c-text-3)]"><Star className="h-3 w-3 fill-gold text-gold" />{product.rating.toFixed(1)}</span>
              )}
            </p>
          </Link>
          {!isOwn && (
            <button onClick={addToCart} disabled={add.isPending}
              className={cn('h-9 px-3.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5 transition-colors press flex-shrink-0',
                added ? 'bg-brand-green/12 text-brand-green' : 'bg-brand-green text-white hover:bg-brand-emerald')}>
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
              {added ? t('feed.inCart') : t('feed.addToCart')}
            </button>
          )}
        </div>
      )}

      {/* What you can do */}
      <div className="flex items-center gap-1 px-2 pt-1.5">
        <button onClick={() => toggleLike()} aria-label={liked ? t('feed.unlike') : t('feed.like')} aria-pressed={liked}
          className="w-10 h-10 flex items-center justify-center press">
          <motion.span key={String(liked)} initial={{ scale: liked ? 0.6 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}>
            <Heart className={cn('h-[25px] w-[25px]', liked ? 'fill-red-500 text-red-500' : 'text-[var(--c-text)]')} strokeWidth={1.9} />
          </motion.span>
        </button>
        <button onClick={isReel ? () => navigate(href, { state: { reel, openComments: true } }) : askSeller}
          aria-label={isReel ? t('feed.comments') : t('feed.askSeller')} className="w-10 h-10 flex items-center justify-center text-[var(--c-text)] press">
          <MessageCircle className="h-[25px] w-[25px] -scale-x-100" strokeWidth={1.9} />
        </button>
        <button onClick={() => (isReel ? (requireAuth() && setSharing(true)) : shareProduct())} aria-label={t('common.share')}
          className="w-10 h-10 flex items-center justify-center text-[var(--c-text)] press">
          <Send className="h-[23px] w-[23px]" strokeWidth={1.9} />
        </button>
        <button onClick={toggleSave} aria-label={saved ? t('common.saved') : t('common.save')} aria-pressed={saved}
          className="ml-auto w-10 h-10 flex items-center justify-center text-[var(--c-text)] press">
          <Bookmark className={cn('h-[24px] w-[24px]', saved && 'fill-[var(--c-text)]')} strokeWidth={1.9} />
        </button>
      </div>

      {/* What it says */}
      <div className="px-3.5 pb-4 space-y-1">
        {likes > 0 && <p className="text-[14px] font-semibold text-[var(--c-text)] tabular">{t('feed.likes', { count: likes })}</p>}
        {caption && (
          <p className="text-[14px] text-[var(--c-text)] leading-[1.4] line-clamp-2">
            <Link to={author ? `/profile/${author.username}` : '#'} className="font-semibold mr-1.5">{author?.username}</Link>
            {!isReel && <span className="font-semibold">{product!.title}. </span>}
            <span className="text-[var(--c-text-2)]">{caption}</span>
          </p>
        )}
        {isReel && (reel!.commentCount ?? 0) > 0 && (
          <button onClick={() => navigate(href, { state: { reel, openComments: true } })} className="text-[14px] text-[var(--c-text-3)]">
            {t('feed.viewComments', { count: reel!.commentCount })}
          </button>
        )}
        {!isReel && (product!.minimumOrder ?? 0) > 1 && (
          <p className="text-[12.5px] text-[var(--c-text-3)]">{t('feed.minOrder', { amount: product!.minimumOrder, unit: product!.stockUnit ?? product!.priceUnit.replace(/^per\s+/i, '') })}</p>
        )}
      </div>

      {sharing && reel && (
        <ShareSheet reelId={reel._id} onClose={() => setSharing(false)} onShared={() => setSharing(false)} />
      )}
    </article>
  )
})
