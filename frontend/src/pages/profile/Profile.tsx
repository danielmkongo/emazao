import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Calendar, Star, Phone, Video, UserCheck, X, Settings, BadgeCheck, Store, Check } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatNumber, verifiedLabel } from '@/lib/utils'
import { ProfileContent } from '@/components/profile/ProfileContent'
import { StoryAvatar } from '@/components/stories/StoryAvatar'
import { useStoryUI } from '@/lib/stories'
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

const ROLE: Record<string, string> = {
  FARMER: 'Farmer', BUYER: 'Buyer', BUSINESS_BUYER: 'Business buyer', LOGISTICS: 'Logistics', ADMIN: 'eMazao team', SUPER_ADMIN: 'eMazao team',
}

export default function Profile() {
  const { username } = useParams<{ username?: string }>()
  const { user: me } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [followed, setFollowed] = useState(false)
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)
  const [copied, setCopied] = useState(false)
  const openComposer = useStoryUI(s => s.openComposer)

  const targetUsername = username ?? me?.username

  const { data, isLoading } = useQuery({
    queryKey: ['profile', targetUsername],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{
        user: User; sellerProfile: SellerProfile | null; isFollowing: boolean
        stats?: { reels: number; products: number; likesReceived: number }
      }>>(`/users/${targetUsername}`)
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
    // Optimistic, then settle on the server's count. The old display added one
    // to the follower count whenever `followed` was true — including when you
    // already followed them before the page loaded, so it counted you twice.
    onMutate: () => setFollowed(f => !f),
    onError: () => setFollowed(f => !f),
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
    <div className="max-w-[935px] mx-auto px-4 pt-6 md:pt-10">
      <div className="flex items-center gap-6 md:gap-20 md:px-10">
        <div className="w-[86px] h-[86px] md:w-[150px] md:h-[150px] rounded-full skeleton-shimmer flex-shrink-0" />
        <div className="flex-1 space-y-3"><div className="h-4 w-40 rounded skeleton-shimmer" /><div className="h-4 w-56 rounded skeleton-shimmer" /></div>
      </div>
      <div className="grid grid-cols-3 gap-0.5 mt-10">{[...Array(6)].map((_, i) => <div key={i} className="aspect-square skeleton-shimmer" />)}</div>
    </div>
  )

  const user = data?.user
  const seller = data?.sellerProfile
  const isOwnProfile = !username || username === me?.username

  if (!user) return (
    <div className="text-center py-20 text-[var(--c-text-3)]">User not found</div>
  )

  const followerCount = (user as any).followersCount ?? 0
  const stats = data?.stats
  const place = [user.location, user.country !== user.location ? user.country : null].filter(Boolean).join(', ')

  function actions() {
    if (isOwnProfile) return (
      <>
        <Link to="/settings" className={`${grey} flex-1 md:flex-none`}>Edit profile</Link>
        <button onClick={shareProfile} className={`${grey} flex-1 md:flex-none`}>{copied ? <><Check className="h-4 w-4" />Link copied</> : 'Share profile'}</button>
      </>
    )
    return (
      <>
        <button onClick={() => followMutation.mutate()} disabled={followMutation.isPending}
          className={`${btn} flex-1 md:flex-none ${followed ? 'bg-[var(--c-input)] text-[var(--c-text)] hover:bg-[var(--c-raised)]' : 'bg-brand-green text-white hover:bg-brand-emerald'}`}>
          {followed ? <><UserCheck className="h-4 w-4" />Following</> : 'Follow'}
        </button>
        <button onClick={handleMessage} className={`${grey} flex-1 md:flex-none`}>Message</button>
        <button onClick={() => startCall(false)} aria-label={`Call ${user!.name}`} className={`${grey} !px-2.5`}><Phone className="h-4 w-4" /></button>
        <button onClick={() => startCall(true)} aria-label={`Video call ${user!.name}`} className={`${grey} !px-2.5`}><Video className="h-4 w-4" /></button>
      </>
    )
  }

  const shareProfile = async () => {
    const url = `${window.location.origin}/profile/${user.username}`
    try {
      if (navigator.share) await navigator.share({ title: user.name, url })
      else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }
    } catch { /* dismissed */ }
  }

  const stat = (value: number, label: string, onClick?: () => void) => {
    const inner = (
      <>
        <span className="block text-[17px] md:text-[16px] font-bold text-[var(--c-text)] tabular leading-tight">{formatNumber(value)}</span>
        <span className="block text-[12.5px] md:text-[15px] text-[var(--c-text-2)] md:ml-1 md:inline">{label}</span>
      </>
    )
    return onClick
      ? <button onClick={onClick} className="text-center md:text-left md:flex md:items-baseline hover:opacity-70 transition-opacity">{inner}</button>
      : <div className="text-center md:text-left md:flex md:items-baseline">{inner}</div>
  }

  const btn = 'h-9 px-4 rounded-lg text-[14px] font-semibold flex items-center justify-center gap-1.5 transition-colors press'
  const grey = `${btn} bg-[var(--c-input)] text-[var(--c-text)] hover:bg-[var(--c-raised)]`

  return (
    <div className="max-w-[935px] mx-auto pb-8">
      {/* Handle bar (phones) */}
      <div className="md:hidden flex items-center justify-between px-4 h-12">
        <h1 className="flex items-center gap-1.5 text-[19px] font-bold text-[var(--c-text)] min-w-0">
          <span className="truncate">{user.username}</span>
          {user.isVerified && <BadgeCheck className="h-[18px] w-[18px] text-white fill-brand-green flex-shrink-0" />}
        </h1>
        {isOwnProfile && (
          <Link to="/settings" aria-label="Settings" className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-[var(--c-text)] press">
            <Settings className="h-6 w-6" strokeWidth={1.9} />
          </Link>
        )}
      </div>

      <header className="px-4 md:px-10 md:pt-10 md:pb-11 md:flex md:items-start md:gap-20">
        <div className="flex items-center gap-5 md:block">
          {/* Tap the photo to watch their story, as on Instagram */}
          <span className="md:hidden">
            <StoryAvatar user={user} size={86} lookup onNoStory={isOwnProfile ? openComposer : undefined} />
          </span>
          <span className="hidden md:inline-flex">
            <StoryAvatar user={user} size={150} lookup onNoStory={isOwnProfile ? openComposer : undefined} />
          </span>
          <div className="flex-1 grid grid-cols-4 gap-1 md:hidden">
            {stat(stats ? stats.reels + stats.products : 0, 'posts')}
            {stat(followerCount, 'followers', () => setFollowModal('followers'))}
            {stat((user as any).followingCount ?? 0, 'following', () => setFollowModal('following'))}
            {stat(stats?.likesReceived ?? 0, 'likes')}
          </div>
        </div>

        <div className="flex-1 min-w-0 mt-3.5 md:mt-1">
          {/* Desktop: handle and actions on one line */}
          <div className="hidden md:flex items-center gap-2 mb-5 flex-wrap">
            <h1 className="flex items-center gap-1.5 text-[20px] text-[var(--c-text)] mr-3">
              {user.username}
              {user.isVerified && <BadgeCheck className="h-5 w-5 text-white fill-brand-green" />}
            </h1>
            {actions()}
          </div>
          <div className="hidden md:flex gap-10 mb-5">
            {stat(stats ? stats.reels + stats.products : 0, 'posts')}
            {stat(followerCount, 'followers', () => setFollowModal('followers'))}
            {stat((user as any).followingCount ?? 0, 'following', () => setFollowModal('following'))}
            {stat(stats?.likesReceived ?? 0, 'likes')}
          </div>

          <p className="text-[14.5px] font-semibold text-[var(--c-text)]">{user.name}</p>
          <p className="text-[13px] text-[var(--c-text-3)] flex items-center gap-1.5 flex-wrap">
            <span>{ROLE[user.role] ?? 'Member'}</span>
            {user.isVerified && <><span>·</span><span className="text-brand-green font-medium">{verifiedLabel(user.verifiedType)}</span></>}
          </p>
          {user.bio && <p className="text-[14.5px] text-[var(--c-text)] leading-snug mt-1 whitespace-pre-line">{user.bio}</p>}
          <p className="text-[13px] text-[var(--c-text-3)] mt-1 flex items-center gap-3 flex-wrap">
            {place && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{place}</span>}
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Joined {formatDate(user.createdAt)}</span>
          </p>

          {/* The shop, for sellers: the one thing a visitor most wants from a farmer's page */}
          {user.role === 'FARMER' && seller && (
            <Link to={`/farm/${user.username}`}
              className="mt-3 flex items-center gap-3 p-3 rounded-2xl border border-[var(--c-border)] hover:bg-[var(--c-raised)] transition-colors md:max-w-md">
              <span className="w-10 h-10 rounded-xl bg-brand-green/12 text-brand-green flex items-center justify-center flex-shrink-0"><Store className="h-5 w-5" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-[var(--c-text)] truncate">{seller.farmName}</span>
                <span className="flex items-center gap-2 text-[12.5px] text-[var(--c-text-3)] whitespace-nowrap min-w-0">
                  <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-gold text-gold" />{seller.rating ? seller.rating.toFixed(1) : 'New'}</span>
                  <span>·</span><span>{formatNumber(seller.totalSales ?? 0)} sales</span>
                  {seller.specializations?.[0] && <><span>·</span><span className="truncate">{seller.specializations.slice(0, 2).join(', ')}</span></>}
                </span>
              </span>
              <span className="text-[13px] font-semibold text-brand-green flex-shrink-0">Visit shop</span>
            </Link>
          )}

          <div className="md:hidden flex gap-1.5 mt-3.5">{actions()}</div>
        </div>
      </header>

      <ProfileContent userId={user._id} isOwnProfile={isOwnProfile} isSeller={user.role === 'FARMER'} />

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
