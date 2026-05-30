import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, Bookmark, ShoppingCart, Star, Leaf } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { Product, User } from '@/types'

interface FeedProductCardProps { product: Product }

export const FeedProductCard = ({ product }: FeedProductCardProps) => {
  const seller = product.sellerId as User
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(product.likeCount ?? 0)
  const [saved, setSaved] = useState(false)

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isAuthenticated) { navigate('/login'); return }
    const next = !liked
    setLiked(next)
    setLikeCount(c => next ? c + 1 : c - 1)
    try {
      await api.post('/social/like', { targetId: product._id, targetType: 'Product' })
    } catch {
      setLiked(!next)
      setLikeCount(c => next ? c - 1 : c + 1)
    }
  }

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isAuthenticated) { navigate('/login'); return }
    const next = !saved
    setSaved(next)
    try {
      await api.post('/social/save', { productId: product._id })
    } catch { setSaved(!next) }
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="group bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] overflow-hidden shadow-sm hover:shadow-xl hover:shadow-black/10 hover:border-brand-green/25 transition-[border-color,box-shadow] duration-300"
    >
      {/* Image */}
      <Link to={`/marketplace/product/${product.slug || product._id}`} className="block cursor-pointer">
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--c-input)]">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-green/5 to-brand-emerald/10">
              <Leaf className="h-10 w-10 text-brand-green/25" />
            </div>
          )}

          {/* Bottom scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            {product.isBoosted && <Badge variant="gold">Sponsored</Badge>}
            {product.isOrganic && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-brand-green text-white px-2 py-0.5 rounded-full shadow-md shadow-brand-green/30">
                <Leaf className="h-2.5 w-2.5" /> Organic
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="p-3.5">
        {/* Seller + rating */}
        <Link to={`/farm/${seller?.username}`} className="flex items-center gap-2 mb-2 group/seller cursor-pointer">
          <Avatar src={seller?.avatar} name={seller?.name} size="xs" verified={seller?.isVerified} />
          <span className="text-xs text-[var(--c-text-3)] group-hover/seller:text-brand-green transition-colors truncate flex-1">
            {seller?.name}
          </span>
          {(product.rating ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-[var(--c-text-3)] flex-shrink-0">
              <Star className="h-3 w-3 fill-gold text-gold" />
              {product.rating.toFixed(1)}
            </span>
          )}
        </Link>

        {/* Title */}
        <Link to={`/marketplace/product/${product.slug || product._id}`} className="cursor-pointer">
          <h3 className="font-semibold text-[var(--c-text)] text-sm leading-snug mb-3 hover:text-brand-green transition-colors line-clamp-2">
            {product.title}
          </h3>
        </Link>

        {/* Price chip + CTA */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-baseline gap-1 bg-brand-green/8 border border-brand-green/12 rounded-lg px-2.5 py-1.5 min-w-0">
            <span className="text-sm font-bold text-brand-green truncate" style={{ fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(product.price)}
            </span>
            <span className="text-[10px] text-[var(--c-text-4)] truncate flex-shrink-0">{product.priceUnit}</span>
          </div>
          <Link to={`/marketplace/product/${product.slug || product._id}`} className="cursor-pointer flex-shrink-0">
            <Button size="sm" className="h-8 px-3 text-xs gap-1">
              <ShoppingCart className="h-3.5 w-3.5" /> Buy
            </Button>
          </Link>
        </div>

        {/* Social strip */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--c-border)]">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 text-xs text-[var(--c-text-3)] hover:text-red-500 transition-colors cursor-pointer"
          >
            <Heart className={`h-3.5 w-3.5 transition-colors ${liked ? 'fill-red-500 text-red-500' : ''}`} />
            <span>{formatNumber(likeCount)}</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 text-xs text-[var(--c-text-3)] hover:text-brand-green transition-colors cursor-pointer"
          >
            <Bookmark className={`h-3.5 w-3.5 transition-colors ${saved ? 'fill-brand-green text-brand-green' : ''}`} />
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>
          <span className="ml-auto text-xs text-[var(--c-text-4)]">{formatNumber(product.viewCount ?? 0)} views</span>
        </div>
      </div>
    </motion.div>
  )
}
