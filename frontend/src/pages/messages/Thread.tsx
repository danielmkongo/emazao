import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { getSocket } from '@/lib/socket'
import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

interface Message {
  _id: string
  senderId: User | string
  content: string
  mediaUrl?: string
  readAt?: string
  createdAt: string
}

interface Conversation {
  _id: string
  participants: User[]
  lastMessage: string
  lastMessageAt: string
}

export default function Thread() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Message[]>>(`/messages/${id}`)
      await api.put(`/messages/${id}/read`)
      return res.data.data
    },
  })

  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Conversation[]>>('/messages')
      return res.data.data
    },
  })

  const conversation = conversations?.find(c => c._id === id)
  const other = conversation?.participants.find(p => p._id !== user?._id) ?? conversation?.participants[0]

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post<ApiResponse<{ message: Message }>>('/messages', { conversationId: id, content })
      return res.data.data.message
    },
    onSuccess: (msg) => {
      queryClient.setQueryData(['messages', id], (old: Message[] = []) => [...old, msg])
      setText('')
    },
  })

  useEffect(() => {
    if (!user?._id || !id) return
    const socket = getSocket(user._id)
    socket.emit('join_conversation', id)
    socket.on('message:new', (msg: Message) => {
      queryClient.setQueryData(['messages', id], (old: Message[] = []) => [...old, msg])
    })
    return () => { socket.off('message:new'); socket.emit('leave_conversation', id) }
  }, [id, user?._id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = () => {
    if (!text.trim()) return
    sendMutation.mutate(text.trim())
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--c-border)] bg-[var(--c-card)]">
        <button onClick={() => navigate(-1)} className="text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {other && <Avatar src={other.avatar} name={other.name} size="sm" verified={other.isVerified} />}
        <div>
          <p className="font-semibold text-[var(--c-text)] text-sm">{other?.name ?? 'User'}</p>
          <p className="text-[var(--c-text-4)] text-xs">@{other?.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--c-bg)]">
        {isLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-2xl w-3/4" />)}</div>
        ) : messages?.map((msg) => {
          const isMe = (typeof msg.senderId === 'string' ? msg.senderId : (msg.senderId as User)._id) === user?._id
          return (
            <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                isMe
                  ? 'bg-brand-green text-white rounded-br-sm'
                  : 'bg-[var(--c-card)] border border-[var(--c-border)] text-[var(--c-text)] rounded-bl-sm'
              }`}>
                <p>{msg.content}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-white/60' : 'text-[var(--c-text-4)]'}`}>{timeAgo(msg.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--c-border)] bg-[var(--c-card)]">
        <div className="flex items-center gap-3">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-2.5 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="w-10 h-10 rounded-xl bg-brand-green flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-all"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
