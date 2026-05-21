import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
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
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Conversation[]>>('/messages')
      return res.data.data
    },
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <div className="text-center py-20">
          <MessageSquare className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">No conversations yet</p>
          <p className="text-white/20 text-sm mt-1">Message a farmer or buyer to get started</p>
        </div>
      ) : (
        <div className="space-y-1">
          {data.map((conv, i) => {
            const other = conv.participants.find(p => p._id !== user?._id) ?? conv.participants[0]
            return (
              <motion.div key={conv._id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <Link to={`/messages/${conv._id}`}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-brand-800 transition-colors">
                  <Avatar src={other?.avatar} name={other?.name ?? 'User'} size="md" verified={other?.isVerified} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-white">{other?.name ?? 'User'}</p>
                      {conv.lastMessageAt && <p className="text-white/30 text-xs">{timeAgo(conv.lastMessageAt)}</p>}
                    </div>
                    <p className="text-white/40 text-sm truncate">{conv.lastMessage || 'Start a conversation'}</p>
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
