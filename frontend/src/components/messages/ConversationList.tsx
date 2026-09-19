import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Edit, X, Search, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { StoryAvatar } from '@/components/stories/StoryAvatar'
import { shortAgo } from '@/components/stories/StoryViewer'
import { useStoryFeed } from '@/lib/stories'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

interface Conversation {
  _id: string
  participants: User[]
  lastMessage: string
  lastMessageAt: string
  type: string
  unreadCount?: number
}

function useDebounce<T>(value: T, ms: number): T {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t) }, [value, ms])
  return d
}

const ROLE_LABELS: Record<string, string> = {
  FARMER: 'Farmer', BUYER: 'Buyer', BUSINESS_BUYER: 'Business',
  LOGISTICS: 'Logistics', ADMIN: 'Admin', SUPER_ADMIN: 'Admin',
}

/**
 * The conversation list — shared by the mobile full-page inbox and the
 * always-visible left column of the desktop split-pane (see MessagesLayout).
 * `activeId` only matters on desktop, where the list stays on screen next to
 * the open thread and needs to show which one that is.
 */
export function ConversationList({ activeId }: { activeId?: string }) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [composing, setComposing] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [filter, setFilter] = useState('')
  const { data: storyGroups } = useStoryFeed()
  const storiesByUser = useMemo(() => new Map((storyGroups ?? []).map(g => [g.user._id, g])), [storyGroups])
  const debouncedQ = useDebounce(searchQ, 300)

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Conversation[]>>('/messages')
      return res.data.data
    },
  })

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ['user-search', debouncedQ],
    queryFn: async () => {
      const params = new URLSearchParams({ role: 'ALL', limit: '15' })
      if (debouncedQ) params.set('q', debouncedQ)
      const res = await api.get<ApiResponse<User[]>>(`/users?${params}`)
      return (res.data.data ?? []).filter(u => u._id !== user?._id)
    },
    enabled: composing,
    staleTime: 10_000,
  })

  const openCompose = () => {
    setSearchQ('')
    setComposing(true)
  }

  const selectUser = (recipient: User) => {
    setComposing(false)
    const existing = conversations?.find(c =>
      c.participants.some(p => p._id === recipient._id)
    )
    if (existing) {
      navigate(`/messages/${existing._id}`)
    } else {
      navigate(`/messages/new?recipientId=${recipient._id}`, { state: { recipient } })
    }
  }

  const displayedUsers = searchResults ?? []
  const shown = (conversations ?? []).filter(c => {
    if (!filter.trim()) return true
    const other = c.participants.find(p => String(p._id) !== String(user?._id))
    const f = filter.trim().toLowerCase()
    return !!other && (other.name?.toLowerCase().includes(f) || other.username?.toLowerCase().includes(f))
  })

  return (
    <div className="flex flex-col h-full w-full min-w-0">
      <div className="px-4 pt-3 lg:pt-7 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[22px] font-bold text-[var(--c-text)] truncate">{user?.username ?? 'Messages'}</h1>
          <button onClick={openCompose} title="New message" aria-label="New message"
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-[var(--c-text)] hover:bg-[var(--c-raised)] press">
            <Edit className="h-[22px] w-[22px]" strokeWidth={1.9} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--c-text-3)] pointer-events-none" />
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search" aria-label="Search conversations"
            className="w-full h-10 rounded-xl bg-[var(--c-input)] pl-10 pr-3 text-[15px] text-[var(--c-text)] placeholder:text-[var(--c-text-3)] focus:outline-none focus:ring-2 focus:ring-brand-green/40" />
        </div>
        <p className="text-[15px] font-bold text-[var(--c-text)] mt-4">Messages</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {isLoading ? (
          <div className="space-y-2 p-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : !conversations?.length ? (
          <div className="text-center py-24 px-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-7 w-7 text-[var(--c-text-4)]" />
            </div>
            <p className="text-[var(--c-text)] font-semibold mb-1">No conversations yet</p>
            <p className="text-[var(--c-text-3)] text-sm mb-4">Message a farmer or buyer to get started</p>
            <button
              onClick={openCompose}
              className="px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-semibold hover:bg-brand-emerald transition-colors"
            >
              Start a conversation
            </button>
          </div>
        ) : (
          <div>
            {shown.map((conv) => {
              // Never fall back to participants[0]: that is whoever opened the
              // conversation, so when the signed-in id is momentarily unknown the
              // list would show your own name and avatar for every thread.
              const other = user?._id
                ? conv.participants.find(p => String(p._id) !== String(user._id))
                : undefined
              const isActive = conv._id === activeId
              const hasUnread = (conv.unreadCount ?? 0) > 0
              return (
                <Link key={conv._id} to={`/messages/${conv._id}`} className="block min-w-0">
                  <div className={`flex items-center gap-3 px-4 py-2 transition-colors ${isActive ? 'bg-[var(--c-raised)]' : 'hover:bg-[var(--c-raised)]/60'}`}>
                    {other
                      ? <StoryAvatar user={other} size={52} group={storiesByUser.get(other._id)} />
                      : <span className="w-[52px] h-[52px] rounded-full bg-[var(--c-input)] flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14.5px] truncate text-[var(--c-text)] ${hasUnread ? 'font-bold' : 'font-medium'}`}>
                        {other?.name ?? 'User'}
                        {conv.type === 'BID_NEGOTIATION' && <span className="ml-1.5 text-[11px] font-semibold text-gold">· Bid</span>}
                      </p>
                      <p className={`text-[13.5px] flex min-w-0 ${hasUnread ? 'text-[var(--c-text)] font-semibold' : 'text-[var(--c-text-3)]'}`}>
                        <span className="truncate">{hasUnread && (conv.unreadCount ?? 0) > 1 ? `${conv.unreadCount} new messages` : (conv.lastMessage || 'Start a conversation')}</span>
                        {conv.lastMessageAt && <span className="flex-shrink-0 text-[var(--c-text-3)] font-normal">&nbsp;· {shortAgo(conv.lastMessageAt)}</span>}
                      </p>
                    </div>
                    {hasUnread && <span className="w-2.5 h-2.5 rounded-full bg-brand-green flex-shrink-0" aria-label="Unread" />}
                  </div>
                </Link>
              )
            })}
            {!shown.length && <p className="text-center text-[var(--c-text-3)] text-sm py-10">No chats match “{filter}”</p>}
          </div>
        )}
      </div>

      {/* Compose Modal */}
      <AnimatePresence>
        {composing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setComposing(false) }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setComposing(false)} />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative w-full max-w-md bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl shadow-2xl overflow-hidden z-10"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
                <h2 className="font-semibold text-[var(--c-text)]">New Message</h2>
                <button
                  onClick={() => setComposing(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)] hover:text-[var(--c-text)] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search */}
              <div className="px-4 py-3 border-b border-[var(--c-border)]">
                <div className="flex items-center gap-2 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 focus-within:border-brand-green transition-all">
                  <Search className="h-4 w-4 text-[var(--c-text-4)] shrink-0" />
                  <input
                    autoFocus
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Search people..."
                    className="flex-1 bg-transparent py-2.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none"
                  />
                  {searching && <Loader2 className="h-3.5 w-3.5 text-[var(--c-text-4)] animate-spin shrink-0" />}
                  {searchQ && !searching && (
                    <button onClick={() => setSearchQ('')} className="text-[var(--c-text-4)] hover:text-[var(--c-text)]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Results */}
              <div className="overflow-y-auto max-h-80">
                {displayedUsers.length === 0 && !searching ? (
                  <div className="text-center py-8">
                    <p className="text-[var(--c-text-3)] text-sm">
                      {searchQ ? 'No people found' : 'Type a name to search'}
                    </p>
                  </div>
                ) : (
                  <div className="py-2">
                    {displayedUsers.map(u => (
                      <button
                        key={u._id}
                        onClick={() => selectUser(u)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--c-raised)] transition-colors text-left"
                      >
                        <Avatar src={u.avatar} name={u.name} size="md" verified={u.isVerified} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[var(--c-text)] text-sm">{u.name}</p>
                          <p className="text-[var(--c-text-4)] text-xs">@{u.username}</p>
                        </div>
                        {u.role && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green shrink-0">
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
