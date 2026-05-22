import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShoppingCart, Heart, Share2, Star, MapPin, Package, ChevronLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, Product, User } from '@/types'

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product>>(`/products/${slug}`)
      return res.data.data
    },
  })

  if (isLoading) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Skeleton className="h-6 w-32 mb-6 rounded-lg" />
      <div className="grid md:grid-cols-2 gap-8">
        <Skeleton className="aspect-square rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4 rounded-xl" />
          <Skeleton className="h-6 w-1/2 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
    </div>
  )

  if (!data) return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <span className="text-6xl mb-4">🔍</span>
      <h2 className="text-xl font-semibold text-[var(--c-text)] mb-2">Product not found</h2>
      <p className="text-[var(--c-text-3)] mb-6">This product may have been removed or the link is invalid.</p>
      <Link to="/marketplace">
        <Button>Browse Marketplace</Button>
      </Link>
    </div>
  )

  const seller = data.sellerId as User

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-text-3)] hover:text-brand-green transition-colors mb-6">
        <ChevronLeft className="h-4 w-4" /> Back to Marketplace
      </Link>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-8">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square rounded-2xl overflow-hidden bg-[var(--c-input)]">
            {data.images[0] ? (
              <img src={data.images[0]} alt={data.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl">🌾</div>
            )}
          </div>
          {data.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {data.images.slice(1, 5).map((img, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-[var(--c-input)]">
                  <img src={img} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity cursor-pointer" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {data.isOrganic && <Badge variant="organic">Organic</Badge>}
            {data.condition && <Badge variant="outline">{data.condition}</Badge>}
          </div>

          <h1 className="text-2xl font-bold text-[var(--c-text)] mb-2">{data.title}</h1>

          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(data.price)}
            </span>
            <span className="text-[var(--c-text-3)]">{data.priceUnit}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-5 text-sm text-[var(--c-text-3)]">
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-gold text-gold" />
              {(data.rating ?? 0).toFixed(1)}
              {data.ratingCount > 0 && <span className="text-[var(--c-text-4)]">({data.ratingCount} reviews)</span>}
            </span>
            <span className="flex items-center gap-1.5">
              <Package className="h-4 w-4" />
              {formatNumber(data.availableStock ?? 0)} {data.stockUnit} available
            </span>
            <span>{formatNumber(data.viewCount)} views</span>
          </div>

          <p className="text-[var(--c-text-2)] text-sm leading-relaxed mb-6">{data.description}</p>

          {/* Certifications */}
          {(data as any).certifications?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {(data as any).certifications.map((cert: string) => (
                <span key={cert} className="flex items-center gap-1.5 text-xs bg-brand-green/8 text-brand-green border border-brand-green/20 rounded-full px-3 py-1">
                  <CheckCircle2 className="h-3 w-3" /> {cert}
                </span>
              ))}
            </div>
          )}

          {/* Seller */}
          <div className="flex items-center gap-3 p-4 bg-[var(--c-input)] rounded-xl mb-6 border border-[var(--c-border)]">
            <Avatar src={seller?.avatar} name={seller?.name} size="md" verified={seller?.isVerified} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--c-text)] text-sm">{seller?.name}</p>
              <p className="text-xs text-[var(--c-text-3)] flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />{seller?.country}
              </p>
            </div>
            <Link to={`/farm/${seller?.username}`}>
              <Button variant="outline" size="sm">View Farm</Button>
            </Link>
          </div>

          {/* Min order info */}
          {data.minimumOrder && (
            <p className="text-xs text-[var(--c-text-3)] mb-4 bg-[var(--c-input)] rounded-lg px-3 py-2 border border-[var(--c-border)]">
              Minimum order: <span className="font-semibold text-[var(--c-text)]">{data.minimumOrder} {data.stockUnit}</span>
            </p>
          )}

          <div className="flex gap-3">
            <Button size="lg" className="flex-1">
              <ShoppingCart className="h-5 w-5" /> Buy Now
            </Button>
            <Button size="lg" variant="secondary">
              <Heart className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="secondary">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
