import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, Bookmark, ShoppingCart, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { Product, User } from '@/types'

interface FeedProductCardProps {
  product: Product
}

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
    } catch {
      setSaved(!next)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {/* Image */}
      <Link to={`/marketplace/product/${product.slug || product._id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--c-input)]">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.title}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🌾</div>
          )}
          {product.isBoosted && (
            <div className="absolute top-3 left-3">
              <Badge variant="gold">Sponsored</Badge>
            </div>
          )}
          {product.isOrganic && (
            <div className="absolute top-3 right-3">
              <Badge variant="organic">Organic</Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4">
        {/* Seller */}
        <Link to={`/farm/${seller?.username}`} className="flex items-center gap-2 mb-3 group">
          <Avatar src={seller?.avatar} name={seller?.name} size="xs" verified={seller?.isVerified} />
          <span className="text-xs text-[var(--c-text-3)] group-hover:text-[var(--c-text)] transition-colors">
            {seller?.name}
          </span>
        </Link>

        {/* Title */}
        <Link to={`/marketplace/product/${product.slug || product._id}`}>
          <h3 className="font-semibold text-[var(--c-text)] text-sm leading-tight mb-2 hover:text-brand-green transition-colors line-clamp-2">
            {product.title}
          </h3>
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-lg font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatCurrency(product.price)}
          </span>
          <span className="text-xs text-[var(--c-text-3)]">{product.priceUnit}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-[var(--c-text-3)] mb-4">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-gold text-gold" />
            {(product.rating ?? 0).toFixed(1)}
            {product.ratingCount > 0 && <span className="text-[var(--c-text-4)]">({formatNumber(product.ratingCount)})</span>}
          </span>
          <span>{formatNumber(product.viewCount)} views</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link to={`/marketplace/product/${product.slug || product._id}`} className="flex-1">
            <Button size="sm" className="w-full text-xs h-8">
              <ShoppingCart className="h-3.5 w-3.5" /> Buy
            </Button>
          </Link>
          <Button size="icon-sm" variant="ghost" onClick={handleLike}
            className={liked ? 'text-red-500' : ''}>
            <Heart className={`h-4 w-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={handleSave}
            className={saved ? 'text-brand-green' : ''}>
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-brand-green text-brand-green' : ''}`} />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
