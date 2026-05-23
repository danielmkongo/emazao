import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MapPin, Package, Star, Users, MessageSquare } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FeedProductCard } from '@/components/feed/FeedProductCard'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { Product, User, SellerProfile } from '@/types'

export default function Storefront() {
  const { username } = useParams<{ username: string }>()

  // username param may be a storeSlug or a real username — try both via a seller-profile lookup
  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront', username],
    queryFn: async () => {
      // First try as a username
      const profileRes = await api.get<{ success: boolean; data: { user: User; sellerProfile: SellerProfile | null } }>(`/users/${username}`)
      if (!profileRes.data.success || !profileRes.data.data?.user) {
        throw new Error('Farm not found')
      }
      const { user, sellerProfile } = profileRes.data.data
      const productsRes = await api.get<{ success: boolean; data: Product[] }>(`/products?sellerId=${user._id}`)
      return { user, sellerProfile, products: productsRes.data.data ?? [] }
    },
    retry: false,
  })

  if (isLoading) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Skeleton className="h-48 rounded-2xl mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    </div>
  )

  if (isError || !data) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <Package className="h-16 w-16 text-[var(--c-text-4)] mx-auto mb-4" />
      <h2 className="text-xl font-bold text-[var(--c-text)] mb-2">Farm not found</h2>
      <p className="text-[var(--c-text-3)] text-sm">The storefront you are looking for does not exist or has been removed.</p>
    </div>
  )

  const { user, sellerProfile, products } = data

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Banner */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="relative rounded-2xl overflow-hidden bg-[var(--c-card)] h-48 mb-6 border border-[var(--c-border)]">
        {sellerProfile?.bannerImage
          ? <img src={sellerProfile.bannerImage} alt="" className="w-full h-full object-cover" />
          : (user as any).coverImage
            ? <img src={(user as any).coverImage} alt="" className="w-full h-full object-cover opacity-60" />
            : <div className="w-full h-full bg-gradient-to-br from-brand-green/20 to-brand-emerald/10" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </motion.div>

      {/* Profile row */}
      <div className="flex items-end gap-4 -mt-16 mb-8 px-2">
        <Avatar src={user.avatar} name={user.name} size="2xl" verified={user.isVerified}
          className="ring-4 ring-[var(--c-bg)] flex-shrink-0" />
        <div className="flex-1 pb-2 min-w-0">
          <h1 className="text-xl font-bold text-[var(--c-text)] truncate">
            {sellerProfile?.farmName || user.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--c-text-3)] mt-1">
            {(user.location || user.country) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{user.location || user.country}
              </span>
            )}
            {sellerProfile?.rating && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-gold text-gold" />{sellerProfile.rating.toFixed(1)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />{formatNumber((user as any).followersCount ?? 0)} followers
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />{formatNumber(products.length)} products
            </span>
          </div>
        </div>
        <div className="flex gap-2 pb-2 flex-shrink-0">
          <Link to={`/messages`}>
            <Button size="sm" variant="outline"><MessageSquare className="h-3.5 w-3.5" /></Button>
          </Link>
          <Button size="sm">Follow</Button>
        </div>
      </div>

      {sellerProfile?.farmDescription && (
        <p className="text-[var(--c-text-2)] text-sm mb-6 px-2 leading-relaxed">{sellerProfile.farmDescription}</p>
      )}

      {sellerProfile?.certifications?.length ? (
        <div className="flex flex-wrap gap-2 mb-6 px-2">
          {sellerProfile.certifications.map(c => (
            <span key={c} className="text-xs bg-brand-green/10 text-brand-green border border-brand-green/20 px-3 py-1 rounded-full">
              ✓ {c}
            </span>
          ))}
        </div>
      ) : null}

      {/* Products grid */}
      <div className="px-2">
        <h2 className="text-lg font-bold text-[var(--c-text)] mb-4">Products</h2>
        {!products.length ? (
          <div className="text-center py-12 text-[var(--c-text-3)]">No products listed yet.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {products.map((product) => (
              <FeedProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
