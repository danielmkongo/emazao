import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Edit, X, Search, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
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

export default function Inbox() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [composing, setComposing] = useState(false)
  const [searchQ, setSearchQ] = useState('')
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 lg:max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">Messages</h1>
        <button
          onClick={openCompose}
          className="w-9 h-9 rounded-xl bg-[var(--c-raised)] flex items-center justify-center hover:bg-brand-green/10 hover:text-brand-green transition-colors text-[var(--c-text-3)]"
          title="New message"
        >
          <Edit className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : !conversations?.length ? (
        <div className="text-center py-24">
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
        <div className="space-y-1">
          {conversations.map((conv, i) => {
            const other = conv.participants.find(p => p._id !== user?._id) ?? conv.participants[0]
            return (
              <motion.div
                key={conv._id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link to={`/messages/${conv._id}`}>
                  <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-[var(--c-raised)] transition-colors group">
                    <Avatar src={other?.avatar} name={other?.name ?? 'User'} size="md" verified={other?.isVerified} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-semibold text-[var(--c-text)] text-sm group-hover:text-brand-green transition-colors">
                          {other?.name ?? 'User'}
                        </p>
                        {conv.lastMessageAt && (
                          <p className="text-[var(--c-text-4)] text-xs flex-shrink-0 ml-2">{timeAgo(conv.lastMessageAt)}</p>
                        )}
                      </div>
                      <p className="text-[var(--c-text-3)] text-sm truncate">
                        {conv.lastMessage || 'Start a conversation'}
                      </p>
                      {conv.type === 'BID_NEGOTIATION' && (
                        <span className="text-[10px] font-semibold text-gold bg-gold/10 rounded-full px-2 py-0.5 mt-1 inline-block">
                          Bid Negotiation
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}

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
