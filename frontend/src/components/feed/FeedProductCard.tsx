import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Heart, Bookmark, ShoppingCart, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { Product, User } from '@/types'

interface FeedProductCardProps {
  product: Product
}

export const FeedProductCard = ({ product }: FeedProductCardProps) => {
  const seller = product.sellerId as User

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="bg-brand-800 rounded-2xl border border-white/[0.06] overflow-hidden"
    >
      {/* Image */}
      <Link to={`/marketplace/product/${product.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-brand-700">
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
          <span className="text-xs text-white/50 group-hover:text-white transition-colors">
            {seller?.name}
          </span>
        </Link>

        {/* Title */}
        <Link to={`/marketplace/product/${product.slug}`}>
          <h3 className="font-semibold text-white text-sm leading-tight mb-2 hover:text-brand-lime transition-colors line-clamp-2">
            {product.title}
          </h3>
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatCurrency(product.price)}
          </span>
          <span className="text-xs text-white/40">{product.priceUnit}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-white/30 mb-4">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-gold text-gold" />
            {product.rating.toFixed(1)} ({formatNumber(product.ratingCount)})
          </span>
          <span>{formatNumber(product.viewCount)} views</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1 text-xs h-8">
            <ShoppingCart className="h-3.5 w-3.5" /> Buy
          </Button>
          <Button size="icon-sm" variant="ghost">
            <Heart className="h-4 w-4" />
          </Button>
          <Button size="icon-sm" variant="ghost">
            <Bookmark className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
