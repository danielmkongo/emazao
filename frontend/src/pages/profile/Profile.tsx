import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Calendar, Package, Star, MessageSquare, Phone, Video, UserCheck, UserPlus, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatNumber } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, User, SellerProfile } from '@/types'

function FollowModal({
  username, type, onClose,
}: { username: string; type: 'followers' | 'following'; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['follow-list', username, type],
    queryFn: async () => {
      const res = await api.get<ApiResponse<User[]>>(`/users/${username}/${type}`)
      return res.data.data ?? []
    },
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="bg-[var(--c-card)] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)] flex-shrink-0">
          <h3 className="font-semibold text-[var(--c-text)] capitalize">{type}</h3>
          <button onClick={onClose} className="text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-1">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
            ))
          ) : !data?.length ? (
            <p className="text-center text-[var(--c-text-3)] text-sm py-10">No {type} yet</p>
          ) : data.map(u => (
            <Link key={u._id} to={`/profile/${u.username}`} onClick={onClose}>
              <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--c-raised)] transition-colors cursor-pointer">
                <Avatar src={u.avatar} name={u.name} size="sm" verified={u.isVerified} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--c-text)] text-sm truncate">{u.name}</p>
                  <p className="text-[var(--c-text-3)] text-xs">@{u.username}</p>
                </div>
                {u.country && <span className="text-xs text-[var(--c-text-4)] flex-shrink-0">{u.country}</span>}
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function Profile() {
  const { username } = useParams<{ username?: string }>()
  const { user: me } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [followed, setFollowed] = useState(false)
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)

  const targetUsername = username ?? me?.username

  const { data, isLoading } = useQuery({
    queryKey: ['profile', targetUsername],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ user: User; sellerProfile: SellerProfile | null; isFollowing: boolean }>>(`/users/${targetUsername}`)
      return res.data.data
    },
    enabled: !!targetUsername,
  })

  useEffect(() => {
    if (data?.isFollowing !== undefined) setFollowed(data.isFollowing)
  }, [data])

  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<{ following: boolean }>>(`/users/${user?._id}/follow`)
      return res.data.data
    },
    onSuccess: (result) => {
      setFollowed(result.following)
      queryClient.invalidateQueries({ queryKey: ['profile', targetUsername] })
    },
  })

  const handleMessage = () => {
    if (!user) return
    navigate(`/messages/new?recipientId=${user._id}`, { state: { recipient: user } })
  }

  const startCall = (video: boolean) => {
    if (!me || !user) return
    window.dispatchEvent(new CustomEvent('emazao:call-out', {
      detail: { calleeId: user._id, calleeName: user.name, calleeAvatar: user.avatar, video }
    }))
  }

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
    <div className="text-center py-20 text-[var(--c-text-3)]">User not found</div>
  )

  const followerCount = (user as any).followersCount ?? 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] overflow-hidden mb-4"
      >
        <div className="h-36 bg-gradient-to-br from-brand-green/20 to-brand-emerald/10 overflow-hidden">
          {(user as any).coverImage && (
            <img src={(user as any).coverImage} alt="" className="w-full h-full object-cover opacity-70" />
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-12 flex items-end justify-between mb-4">
            <Avatar src={user.avatar} name={user.name} size="2xl" verified={user.isVerified} />
            {isOwnProfile ? (
              <Link to="/settings">
                <Button size="sm" variant="outline">Edit Profile</Button>
              </Link>
            ) : (
              <div className="flex gap-2 flex-wrap justify-end">
                <Button size="sm" variant="outline" onClick={handleMessage}>
                  <MessageSquare className="h-3.5 w-3.5" /> Message
                </Button>
                <Button size="sm" variant="outline" onClick={() => startCall(false)}>
                  <Phone className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => startCall(true)}>
                  <Video className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" onClick={() => followMutation.mutate()} loading={followMutation.isPending}>
                  {followed ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                  {followed ? 'Following' : 'Follow'}
                </Button>
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-[var(--c-text)]">{user.name}</h1>
              {user.isVerified && (
                <Badge variant="default" className="text-xs">{user.verifiedType ?? 'Verified'}</Badge>
              )}
            </div>
            <p className="text-[var(--c-text-3)] text-sm mb-2">@{user.username}</p>
            {user.bio && <p className="text-[var(--c-text-2)] text-sm leading-relaxed">{user.bio}</p>}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-[var(--c-text-3)] mb-5">
            {user.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />{user.location}
              </span>
            )}
            {user.country && user.country !== user.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />{user.country}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />Joined {formatDate(user.createdAt)}
            </span>
          </div>

          {/* Clickable stats */}
          <div className="flex gap-6 text-sm">
            <button
              onClick={() => setFollowModal('followers')}
              className="text-center cursor-pointer hover:opacity-70 transition-opacity"
            >
              <p className="font-bold text-[var(--c-text)]">{formatNumber(followerCount + (followed && !isOwnProfile ? 1 : 0))}</p>
              <p className="text-[var(--c-text-3)] text-xs">Followers</p>
            </button>
            <button
              onClick={() => setFollowModal('following')}
              className="text-center cursor-pointer hover:opacity-70 transition-opacity"
            >
              <p className="font-bold text-[var(--c-text)]">{formatNumber((user as any).followingCount ?? 0)}</p>
              <p className="text-[var(--c-text-3)] text-xs">Following</p>
            </button>
            {user.role === 'FARMER' && seller && (
              <>
                <div className="text-center">
                  <p className="font-bold text-[var(--c-text)]">{formatNumber(seller.totalSales ?? 0)}</p>
                  <p className="text-[var(--c-text-3)] text-xs">Sales</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-[var(--c-text)] flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-gold fill-gold" />{seller.rating?.toFixed(1) ?? '—'}
                  </p>
                  <p className="text-[var(--c-text-3)] text-xs">Rating</p>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {user.role === 'FARMER' && seller && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 mb-4"
        >
          <h2 className="font-semibold text-[var(--c-text)] mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-brand-green" /> Farm Details
          </h2>
          <p className="font-semibold text-[var(--c-text)] mb-1">{seller.farmName}</p>
          {seller.farmDescription && (
            <p className="text-[var(--c-text-2)] text-sm mb-3 leading-relaxed">{seller.farmDescription}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {seller.specializations?.map(s => (
              <span key={s} className="text-xs bg-[var(--c-raised)] text-[var(--c-text-2)] px-2.5 py-1 rounded-full border border-[var(--c-border)]">
                {s}
              </span>
            ))}
          </div>
          <Link to={`/farm/${user.username}`} className="mt-4 block">
            <Button size="sm" variant="outline" className="w-full">View Storefront</Button>
          </Link>
        </motion.div>
      )}

      {/* Followers / Following modal */}
      <AnimatePresence>
        {followModal && (
          <FollowModal
            username={targetUsername!}
            type={followModal}
            onClose={() => setFollowModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
