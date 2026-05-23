import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MessageSquare, Edit } from 'lucide-react'
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

export default function Inbox() {
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['conversations', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Conversation[]>>('/messages')
      return res.data.data
    },
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 lg:max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)]">Messages</h1>
        <button className="w-9 h-9 rounded-xl bg-[var(--c-raised)] flex items-center justify-center hover:bg-brand-green/10 hover:text-brand-green transition-colors text-[var(--c-text-3)]">
          <Edit className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-7 w-7 text-[var(--c-text-4)]" />
          </div>
          <p className="text-[var(--c-text)] font-semibold mb-1">No conversations yet</p>
          <p className="text-[var(--c-text-3)] text-sm">Message a farmer or buyer to get started</p>
        </div>
      ) : (
        <div className="space-y-1">
          {data.map((conv, i) => {
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
    </div>
  )
}
