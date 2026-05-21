import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MapPin, Package, Star, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FeedProductCard } from '@/components/feed/FeedProductCard'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { Product, User, SellerProfile } from '@/types'

export default function Storefront() {
  const { username } = useParams<{ username: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['storefront', username],
    queryFn: async () => {
      const profile = await api.get<{ success: boolean; data: { user: User; sellerProfile: SellerProfile } }>(`/users/${username}`)
      const products = await api.get<{ success: boolean; data: Product[] }>(`/products?sellerId=${profile.data.data.user._id}`)
      return { ...profile.data.data, products: products.data.data }
    },
  })

  if (isLoading) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Skeleton className="h-48 rounded-2xl mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    </div>
  )

  const { user, sellerProfile, products } = data!

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Banner */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative rounded-2xl overflow-hidden bg-brand-800 h-48 mb-6">
        {sellerProfile?.bannerImage && <img src={sellerProfile.bannerImage} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </motion.div>

      {/* Profile */}
      <div className="flex items-end gap-4 -mt-12 mb-8 px-4">
        <Avatar src={user.avatar} name={user.name} size="2xl" verified={user.isVerified} className="ring-4 ring-brand-dark" />
        <div className="flex-1 pb-2">
          <h1 className="text-xl font-bold text-white">{sellerProfile?.farmName || user.name}</h1>
          <div className="flex items-center gap-4 text-sm text-white/40 mt-1">
            {user.country && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{user.country}</span>}
            <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-gold text-gold" />{sellerProfile?.rating?.toFixed(1)}</span>
            <span className="flex items-center gap-1"><Users className="h-4 w-4" />{formatNumber(user.followersCount)} followers</span>
            <span className="flex items-center gap-1"><Package className="h-4 w-4" />{formatNumber(products?.length ?? 0)} products</span>
          </div>
        </div>
        <Button className="mb-2">Follow</Button>
      </div>

      {sellerProfile?.farmDescription && (
        <p className="text-white/60 text-sm mb-8 px-4">{sellerProfile.farmDescription}</p>
      )}

      {/* Products grid */}
      <h2 className="text-lg font-bold text-white mb-4 px-4">Products</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {products?.map((product) => (
          <FeedProductCard key={product._id} product={product} />
        ))}
      </div>
    </div>
  )
}
