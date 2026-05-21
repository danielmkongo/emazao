import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShoppingCart, Heart, Share2, Star, MapPin, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
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
    <div className="max-w-4xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8">
      <Skeleton className="aspect-square rounded-2xl" />
      <div className="space-y-4"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-6 w-1/2" /><Skeleton className="h-32" /></div>
    </div>
  )

  if (!data) return <div className="p-8 text-center text-white/40">Product not found</div>

  const seller = data.sellerId as User

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-8">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square rounded-2xl overflow-hidden bg-brand-800">
            {data.images[0] ? (
              <img src={data.images[0]} alt={data.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl">🌾</div>
            )}
          </div>
          {data.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {data.images.slice(1, 5).map((img, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-brand-800">
                  <img src={img} alt="" className="w-full h-full object-cover" />
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

          <h1 className="text-2xl font-bold text-white mb-2">{data.title}</h1>

          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(data.price)}
            </span>
            <span className="text-white/40">{data.priceUnit}</span>
          </div>

          <div className="flex items-center gap-4 mb-5 text-sm text-white/40">
            <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-gold text-gold" />{data.rating.toFixed(1)} ({data.ratingCount} reviews)</span>
            <span className="flex items-center gap-1.5"><Package className="h-4 w-4" />{data.availableStock} {data.stockUnit} available</span>
          </div>

          <p className="text-white/60 text-sm leading-relaxed mb-6">{data.description}</p>

          {/* Seller */}
          <div className="flex items-center gap-3 p-4 bg-brand-800 rounded-xl mb-6">
            <Avatar src={seller?.avatar} name={seller?.name} size="md" verified={seller?.isVerified} />
            <div>
              <p className="font-medium text-white text-sm">{seller?.name}</p>
              <p className="text-xs text-white/40 flex items-center gap-1"><MapPin className="h-3 w-3" />{seller?.country}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto">View Farm</Button>
          </div>

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
