import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MapPin, Calendar, Users, Package, Star, MessageSquare } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatNumber } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, User, SellerProfile } from '@/types'

export default function Profile() {
  const { username } = useParams<{ username?: string }>()
  const { user: me } = useAuthStore()

  const targetUsername = username ?? me?.username

  const { data, isLoading } = useQuery({
    queryKey: ['profile', targetUsername],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ user: User; sellerProfile: SellerProfile | null }>>(`/users/${targetUsername}`)
      return res.data.data
    },
    enabled: !!targetUsername,
  })

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  )

  const user = data?.user
  const seller = data?.sellerProfile
  const isOwnProfile = !username || username === me?.username

  if (!user) return (
    <div className="text-center py-20 text-white/40">User not found</div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Cover + Avatar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-brand-800 rounded-2xl border border-white/[0.06] overflow-hidden mb-4">
        <div className="h-32 bg-gradient-to-br from-brand-green/30 to-brand-emerald/20" />
        <div className="px-6 pb-6">
          <div className="-mt-12 flex items-end justify-between mb-4">
            <Avatar src={user.avatar} name={user.name} size="2xl" verified={user.isVerified} />
            {isOwnProfile ? (
              <Link to="/settings">
                <Button size="sm" variant="outline">Edit Profile</Button>
              </Link>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <MessageSquare className="h-3.5 w-3.5" /> Message
                </Button>
                <Button size="sm">Follow</Button>
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{user.name}</h1>
              {user.isVerified && (
                <Badge variant="default" className="text-xs">{user.verifiedType ?? 'Verified'}</Badge>
              )}
            </div>
            <p className="text-white/40 text-sm mb-2">@{user.username}</p>
            {user.bio && <p className="text-white/70 text-sm">{user.bio}</p>}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-white/40 mb-4">
            {user.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{user.location}</span>}
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Joined {formatDate(user.createdAt)}</span>
          </div>

          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <p className="font-bold text-white">{formatNumber((user as any).followersCount ?? 0)}</p>
              <p className="text-white/40 text-xs">Followers</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-white">{formatNumber((user as any).followingCount ?? 0)}</p>
              <p className="text-white/40 text-xs">Following</p>
            </div>
            {user.role === 'FARMER' && seller && (
              <>
                <div className="text-center">
                  <p className="font-bold text-white">{formatNumber(seller.totalSales ?? 0)}</p>
                  <p className="text-white/40 text-xs">Sales</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-white flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-gold fill-gold" />{seller.rating?.toFixed(1) ?? '—'}
                  </p>
                  <p className="text-white/40 text-xs">Rating</p>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Seller Profile */}
      {user.role === 'FARMER' && seller && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-brand-800 rounded-2xl border border-white/[0.06] p-5 mb-4">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-brand-green" /> Farm Details
          </h2>
          <p className="font-medium text-white mb-1">{seller.farmName}</p>
          {seller.farmDescription && <p className="text-white/50 text-sm mb-3">{seller.farmDescription}</p>}
          <div className="flex flex-wrap gap-2">
            {seller.specializations?.map(s => (
              <span key={s} className="text-xs bg-brand-700 text-white/60 px-2.5 py-1 rounded-full">{s}</span>
            ))}
          </div>
          {seller.storeSlug && (
            <Link to={`/farm/${seller.storeSlug}`} className="mt-4 block">
              <Button size="sm" variant="outline" className="w-full">View Storefront</Button>
            </Link>
          )}
        </motion.div>
      )}
    </div>
  )
}
