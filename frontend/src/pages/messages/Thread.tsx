import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Phone, Video, Check, CheckCheck } from 'lucide-react'
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

function isSameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (isSameDay(dateStr, today.toISOString())) return 'Today'
  if (isSameDay(dateStr, yesterday.toISOString())) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
}

// Append a message only if it isn't already in the list. The backend broadcasts
// 'message:new' to the whole conversation room — including the sender — so without
// this the sender would see their own message twice (once optimistically, once echoed).
const appendUnique = (old: Message[] = [], m: Message) =>
  old.some(x => x._id === m._id) ? old : [...old, m]

export default function Thread() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const isNewConvo = id === 'new'
  const recipientIdParam = searchParams.get('recipientId')
  // Recipient passed via navigate state (from compose modal / Message button)
  const stateRecipient = (location.state as { recipient?: User } | null)?.recipient

  // Fetch recipient by ID if not in navigation state
  const { data: fetchedRecipient } = useQuery({
    queryKey: ['user-by-id', recipientIdParam],
    queryFn: async () => {
      const res = await api.get<ApiResponse<User>>(`/users/by-id/${recipientIdParam}`)
      return res.data.data
    },
    enabled: isNewConvo && !!recipientIdParam && !stateRecipient,
  })

  const newConvoRecipient = stateRecipient ?? fetchedRecipient

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Message[]>>(`/messages/${id}`)
      await api.put(`/messages/${id}/read`)
      return res.data.data
    },
    enabled: !isNewConvo && !!id,
  })

  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Conversation[]>>('/messages')
      return res.data.data
    },
  })

  const conversation = conversations?.find(c => c._id === id)
  const conversationOther = conversation?.participants.find(p => p._id !== user?._id) ?? conversation?.participants[0]
  const other = isNewConvo ? newConvoRecipient : conversationOther

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (isNewConvo) {
        const res = await api.post<ApiResponse<{ message: Message; conversationId: string }>>(
          '/messages',
          { recipientId: recipientIdParam, content }
        )
        return res.data.data
      }
      const res = await api.post<ApiResponse<{ message: Message; conversationId: string }>>(
        '/messages',
        { conversationId: id, content }
      )
      return res.data.data
    },
    onSuccess: (data) => {
      if (isNewConvo) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        navigate(`/messages/${data.conversationId}`, { replace: true })
      } else {
        queryClient.setQueryData(['messages', id], (old: Message[] = []) => appendUnique(old, data.message))
        setText('')
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    },
  })

  useEffect(() => {
    if (!user?._id || !id || isNewConvo) return
    const socket = getSocket(user._id)
    socket.emit('join_conversation', id)
    socket.on('message:new', (msg: Message) => {
      queryClient.setQueryData(['messages', id], (old: Message[] = []) => appendUnique(old, msg))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
    return () => { socket.off('message:new'); socket.emit('leave_conversation', id) }
  }, [id, user?._id, isNewConvo])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  const handleSend = () => {
    if (!text.trim() || sendMutation.isPending) return
    sendMutation.mutate(text.trim())
    if (!isNewConvo) setText('')
  }

  const getSenderId = (msg: Message) =>
    typeof msg.senderId === 'string' ? msg.senderId : (msg.senderId as User)._id

  const grouped = (messages ?? []).map((msg, i, arr) => {
    const isMe = getSenderId(msg) === user?._id
    const prevSame = i > 0 && getSenderId(arr[i - 1]) === getSenderId(msg)
    const nextSame = i < arr.length - 1 && getSenderId(arr[i + 1]) === getSenderId(msg)
    const showDay = i === 0 || !isSameDay(msg.createdAt, arr[i - 1].createdAt)
    const isLast = !nextSame
    return { msg, isMe, prevSame, nextSame, isLast, showDay }
  })

  const startCall = (video: boolean) => {
    if (!other?._id) return
    window.dispatchEvent(new CustomEvent('emazao:call-out', {
      detail: { calleeId: other._id, calleeName: other.name, calleeAvatar: other.avatar, video },
    }))
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-130px)] lg:h-screen bg-[var(--c-bg)]">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--c-border)] bg-[var(--c-card)] z-10 shrink-0">
        <button onClick={() => navigate(-1)} className="text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors lg:hidden">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {other ? (
          <Avatar src={other.avatar} name={other.name} size="sm" verified={other.isVerified} />
        ) : (
          <div className="h-8 w-8 rounded-full bg-[var(--c-input)]" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--c-text)] text-sm leading-tight truncate">{other?.name ?? '…'}</p>
          {other?.username && <p className="text-[var(--c-text-4)] text-xs">@{other.username}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => startCall(false)} disabled={!other} aria-label="Voice call" className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)] hover:text-[var(--c-text)] transition-colors disabled:opacity-40">
            <Phone className="h-4 w-4" />
          </button>
          <button onClick={() => startCall(true)} disabled={!other} aria-label="Video call" className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)] hover:text-[var(--c-text)] transition-colors disabled:opacity-40">
            <Video className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
        {isNewConvo ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            {other ? (
              <>
                <Avatar src={other.avatar} name={other.name} size="xl" verified={other.isVerified} />
                <div>
                  <p className="font-semibold text-[var(--c-text)]">{other.name}</p>
                  {other.username && <p className="text-[var(--c-text-4)] text-sm">@{other.username}</p>}
                </div>
                <p className="text-[var(--c-text-3)] text-sm max-w-xs">
                  Send a message to start your conversation with {other.name}.
                </p>
              </>
            ) : (
              <p className="text-[var(--c-text-3)] text-sm">Loading…</p>
            )}
          </div>
        ) : isLoading ? (
          <div className="space-y-4 pt-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex gap-2 ${i % 3 === 0 ? 'justify-end' : 'justify-start'}`}>
                {i % 3 !== 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
                <Skeleton className={`h-10 rounded-2xl ${i % 3 === 0 ? 'w-48 bg-brand-green/20' : 'w-56'}`} />
              </div>
            ))}
          </div>
        ) : (
          grouped.map(({ msg, isMe, prevSame, isLast, showDay }) => (
            <div key={msg._id}>
              {showDay && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[var(--c-border)]" />
                  <span className="text-[var(--c-text-4)] text-xs font-medium px-2">{formatDay(msg.createdAt)}</span>
                  <div className="flex-1 h-px bg-[var(--c-border)]" />
                </div>
              )}

              <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} ${prevSame ? 'mt-0.5' : 'mt-3'}`}>
                {!isMe && (
                  <div className="w-7 shrink-0">
                    {isLast ? (
                      <Avatar src={other?.avatar} name={other?.name} size="xs" verified={other?.isVerified} />
                    ) : null}
                  </div>
                )}

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%]`}>
                  <div
                    className={`
                      px-4 py-2.5 text-sm leading-relaxed break-words
                      ${isMe
                        ? `bg-brand-green text-white
                           ${!prevSame ? 'rounded-t-2xl' : 'rounded-t-lg'}
                           ${isLast ? 'rounded-bl-2xl rounded-br-sm' : 'rounded-b-lg'}`
                        : `bg-[var(--c-card)] border border-[var(--c-border)] text-[var(--c-text)]
                           ${!prevSame ? 'rounded-t-2xl' : 'rounded-t-lg'}
                           ${isLast ? 'rounded-br-2xl rounded-bl-sm' : 'rounded-b-lg'}`
                      }
                    `}
                  >
                    {msg.content}
                  </div>

                  {isLast && (
                    <div className={`flex items-center gap-1 mt-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[var(--c-text-4)] text-[10px]">{formatTime(msg.createdAt)}</span>
                      {isMe && (
                        msg.readAt
                          ? <CheckCheck className="h-3 w-3 text-brand-green" />
                          : <Check className="h-3 w-3 text-[var(--c-text-4)]" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 px-4 py-3 border-t border-[var(--c-border)] bg-[var(--c-card)]">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <div className="flex-1 flex items-center bg-[var(--c-input)] border border-[var(--c-border)] rounded-full px-4 transition-all focus-within:border-brand-green">
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={`Message ${other?.name ?? ''}…`}
              className="flex-1 bg-transparent py-2.5 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="w-10 h-10 rounded-full bg-brand-green flex items-center justify-center text-white disabled:opacity-40 hover:bg-brand-emerald transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
