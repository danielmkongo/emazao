import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MapPin, Package, Star, Users, MessageSquare, UserCheck, UserPlus } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FeedProductCard } from '@/components/feed/FeedProductCard'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { Product, User, SellerProfile, ApiResponse } from '@/types'

export default function Storefront() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { user: me, isAuthenticated } = useAuthStore()
  const [following, setFollowing] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront', username],
    queryFn: async () => {
      const profileRes = await api.get<{ success: boolean; data: { user: User; sellerProfile: SellerProfile | null } }>(`/users/${username}`)
      if (!profileRes.data.success || !profileRes.data.data?.user) throw new Error('Farm not found')
      const { user, sellerProfile } = profileRes.data.data
      const productsRes = await api.get<ApiResponse<Product[]>>(`/products?sellerId=${user._id}`)
      return { user, sellerProfile, products: productsRes.data.data ?? [] }
    },
    retry: false,
  })

  const followMutation = useMutation({
    mutationFn: () => api.post(`/users/${data!.user._id}/follow`),
    onMutate: () => setFollowing(f => !f),
    onError: () => setFollowing(f => !f),
  })

  const handleMessage = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    try {
      const res = await api.post<ApiResponse<{ conversationId: string }>>('/messages', {
        recipientId: data!.user._id,
        content: `Hi ${data!.user.name}! I saw your products on eMazao.`,
      })
      navigate(`/messages/${res.data.data.conversationId}`)
    } catch {
      navigate('/messages')
    }
  }

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
      <p className="text-[var(--c-text-3)] text-sm">The storefront you're looking for doesn't exist.</p>
    </div>
  )

  const { user, sellerProfile, products } = data
  const isOwnProfile = me?._id === user._id

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
      {/* Banner */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="relative rounded-2xl overflow-hidden bg-[var(--c-card)] h-48 mb-6 border border-[var(--c-border)]">
        {sellerProfile?.bannerImage
          ? <img src={sellerProfile.bannerImage} alt="" className="w-full h-full object-cover" />
          : (user as any).coverImage
            ? <img src={(user as any).coverImage} alt="" className="w-full h-full object-cover opacity-70" />
            : <div className="w-full h-full bg-gradient-to-br from-brand-green/20 to-brand-emerald/10" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Rating pill */}
        {sellerProfile?.rating && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-xs">
            <Star className="h-3 w-3 fill-gold text-gold" />{sellerProfile.rating.toFixed(1)}
            <span className="text-white/60">({sellerProfile.ratingCount})</span>
          </div>
        )}
      </motion.div>

      {/* Profile row */}
      <div className="flex items-end gap-4 -mt-16 mb-6 px-2">
        <Avatar src={user.avatar} name={user.name} size="2xl" verified={user.isVerified}
          className="ring-4 ring-[var(--c-bg)] flex-shrink-0" />
        <div className="flex-1 pb-2 min-w-0">
          <h1 className="text-xl font-bold text-[var(--c-text)] truncate">
            {sellerProfile?.farmName || user.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--c-text-3)] mt-1">
            {(user.location || user.country) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{user.location || user.country}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />{formatNumber((user as any).followersCount ?? 0)} followers
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />{formatNumber(products.length)} products
            </span>
            {sellerProfile?.totalSales && (
              <span className="text-brand-green font-semibold">{formatNumber(sellerProfile.totalSales)} sales</span>
            )}
          </div>
        </div>

        {!isOwnProfile && (
          <div className="flex gap-2 pb-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={handleMessage}>
              <MessageSquare className="h-3.5 w-3.5" /> Message
            </Button>
            <Button
              size="sm"
              variant={following ? 'secondary' : 'primary'}
              onClick={() => isAuthenticated ? followMutation.mutate() : navigate('/login')}
              disabled={followMutation.isPending}
            >
              {following
                ? <><UserCheck className="h-3.5 w-3.5" /> Following</>
                : <><UserPlus className="h-3.5 w-3.5" /> Follow</>
              }
            </Button>
          </div>
        )}
      </div>

      {/* Farm description */}
      {sellerProfile?.farmDescription && (
        <p className="text-[var(--c-text-2)] text-sm mb-5 px-2 leading-relaxed">{sellerProfile.farmDescription}</p>
      )}

      {/* Certifications */}
      {sellerProfile?.certifications?.length ? (
        <div className="flex flex-wrap gap-2 mb-5 px-2">
          {sellerProfile.certifications.map(c => (
            <span key={c} className="text-xs bg-brand-green/10 text-brand-green border border-brand-green/20 px-3 py-1 rounded-full">
              ✓ {c}
            </span>
          ))}
        </div>
      ) : null}

      {/* Stats row */}
      {sellerProfile && (
        <div className="grid grid-cols-3 gap-3 mb-6 px-2">
          <div className="bg-[var(--c-card)] rounded-xl border border-[var(--c-border)] p-3 text-center">
            <p className="text-brand-green font-bold text-lg font-mono">{sellerProfile.onTimeDelivery ?? 0}%</p>
            <p className="text-[var(--c-text-4)] text-xs">On-time</p>
          </div>
          <div className="bg-[var(--c-card)] rounded-xl border border-[var(--c-border)] p-3 text-center">
            <p className="text-[var(--c-text)] font-bold text-lg">{formatNumber(sellerProfile.totalSales ?? 0)}</p>
            <p className="text-[var(--c-text-4)] text-xs">Sales</p>
          </div>
          <div className="bg-[var(--c-card)] rounded-xl border border-[var(--c-border)] p-3 text-center">
            <p className="text-gold font-bold text-lg">{(sellerProfile.rating ?? 0).toFixed(1)}</p>
            <p className="text-[var(--c-text-4)] text-xs">Rating</p>
          </div>
        </div>
      )}

      {/* Products grid */}
      <div className="px-2">
        <h2 className="text-base font-bold text-[var(--c-text)] mb-4">
          Products <span className="text-[var(--c-text-4)] font-normal text-sm">({products.length})</span>
        </h2>
        {!products.length ? (
          <div className="text-center py-12 text-[var(--c-text-3)] text-sm">No products listed yet.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {products.map(product => (
              <FeedProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
