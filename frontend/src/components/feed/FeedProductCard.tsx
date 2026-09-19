import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Heart, Plus, Check, Star, Leaf, Loader2 } from 'lucide-react'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { useCart } from '@/hooks/useCart'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, cn } from '@/lib/utils'
import api from '@/lib/api'
import type { Product, User } from '@/types'

/** "per kg" → "kg", so the unit reads as "TZS 3,120 / kg". */
export function unitLabel(priceUnit?: string) {
  return (priceUnit ?? '').replace(/^per\s+/i, '').trim() || 'unit'
}

/**
 * A product in a shop grid. The photo does the selling, so it gets the space;
 * the price is set large and never truncated (the old tile clipped it to
 * "T.."); saving and adding to the cart are one tap each, on the photo.
 */
export const FeedProductCard = ({ product }: { product: Product }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated, user: me } = useAuthStore()
  const seller = product.sellerId as User | undefined
  const href = `/marketplace/product/${product.slug || product._id}`

  const [saved, setSaved] = useState(!!product.userSaved)
  useEffect(() => { setSaved(!!product.userSaved) }, [product.userSaved])
  const savePending = useRef(false)

  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!isAuthenticated) { navigate('/login'); return }
    if (savePending.current) return
    savePending.current = true
    const next = !saved
    setSaved(next)
    try { await api.post('/social/save', { targetId: product._id, targetType: 'Product' }) }
    catch { setSaved(!next) }
    finally { savePending.current = false }
  }

  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const isOwn = !!me && seller?._id === me._id
  const quickAdd = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!isAuthenticated) { navigate('/login'); return }
    try {
      await add.mutateAsync({ productId: product._id })
      setAdded(true)
      window.setTimeout(() => setAdded(false), 1800)
    } catch { navigate(href) }
  }

  const outOfStock = product.status === 'OUT_OF_STOCK'

  return (
    <Link to={href} className="group block">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-[var(--c-input)]">
        <ImageWithFallback src={product.images?.[0]} alt={product.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" fallbackClassName="w-full h-full" />

        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {product.isBoosted && (
            <span className="text-[10.5px] font-bold uppercase tracking-wide bg-black/55 text-white px-2 py-0.5 rounded-full backdrop-blur">{t('feed.sponsored')}</span>
          )}
          {product.isOrganic && (
            <span className="flex items-center gap-1 text-[10.5px] font-bold bg-white/90 text-brand-green px-2 py-0.5 rounded-full">
              <Leaf className="h-3 w-3" />{t('feed.organic')}
            </span>
          )}
        </div>

        <button onClick={toggleSave} aria-label={saved ? t('common.saved') : t('common.save')} aria-pressed={saved}
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center press">
          <motion.span key={String(saved)} initial={{ scale: saved ? 0.5 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 15 }}>
            <Heart className={cn('h-[19px] w-[19px]', saved ? 'fill-red-500 text-red-500' : 'text-white')} strokeWidth={2.2} />
          </motion.span>
        </button>

        {outOfStock ? (
          <span className="absolute inset-x-2 bottom-2 text-center text-[12px] font-semibold bg-black/60 text-white rounded-full py-1">{t('shop.soldOut')}</span>
        ) : !isOwn && (
          <button onClick={quickAdd} aria-label={t('feed.addToCart')} disabled={add.isPending}
            className={cn('absolute bottom-2 right-2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg press transition-colors',
              added ? 'bg-brand-green text-white' : 'bg-white text-black hover:bg-brand-green hover:text-white')}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={add.isPending ? 'l' : added ? 'c' : 'p'} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.12 }}>
                {add.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : added ? <Check className="h-5 w-5" strokeWidth={3} /> : <Plus className="h-5 w-5" strokeWidth={2.6} />}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
      </div>

      <div className="pt-2.5 px-0.5">
        <p className="text-[16px] font-bold text-[var(--c-text)] tabular leading-tight">
          {formatCurrency(product.price)}
          <span className="text-[12.5px] font-medium text-[var(--c-text-3)]"> / {unitLabel(product.priceUnit)}</span>
        </p>
        <h3 className="text-[13.5px] text-[var(--c-text-2)] leading-snug line-clamp-2 mt-0.5 min-h-[2.5em]">{product.title}</h3>
        <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-[var(--c-text-3)] min-w-0">
          {seller?.avatar
            ? <img src={seller.avatar} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
            : <span className="w-4 h-4 rounded-full bg-brand-green/30 flex-shrink-0" />}
          <span className="truncate">{seller?.name}</span>
          {(product.ratingCount ?? 0) > 0 && (
            <span className="ml-auto flex items-center gap-0.5 flex-shrink-0 text-[var(--c-text-2)] font-medium">
              <Star className="h-3 w-3 fill-gold text-gold" />{product.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
