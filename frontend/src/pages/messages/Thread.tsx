import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Phone, Video, Check, CheckCheck, Clock, Play } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import { useUnreadStore } from '@/store/unreadStore'
import { refreshUnreadMessages } from '@/hooks/useUnreadMessages'
import { getSocket } from '@/lib/socket'
import api from '@/lib/api'
import { STORY_BACKGROUNDS, type StoryBackground } from '@/lib/stories'
import type { ApiResponse, User } from '@/types'

interface Message {
  _id: string
  senderId: User | string
  content: string
  mediaUrl?: string
  deliveredAt?: string
  readAt?: string
  createdAt: string
  /** Set only on the optimistic copy shown before the server confirms. */
  pending?: boolean
  /** The sender's own id for this message; ties the saved copy to its "sending…" copy. */
  clientId?: string
  /** A reel sent from its share sheet. Null if it has since been removed. */
  sharedReel?: {
    _id: string; thumbnailUrl?: string; videoUrl?: string; caption?: string; title?: string
    status?: string; viewCount?: number; userId?: User
  } | null
  /** A reply or reaction to a story, with a copy of what the story showed. */
  storyReply?: {
    storyId: string; ownerId: string; mediaUrl?: string; mediaType?: 'IMAGE' | 'VIDEO'
    text?: string; background?: StoryBackground; reaction?: string
  }
}

/**
 * What a story reply was about. Stories vanish after a day but the chat stays,
 * so the snapshot is drawn from the copy kept on the message, and labelled so
 * it is clear whose story it was.
 */
function StoryReplyCard({ reply, isMe, otherName }: { reply: NonNullable<Message['storyReply']>; isMe: boolean; otherName?: string }) {
  const whose = `${otherName ?? 'their'}'s story`
  const label = reply.reaction
    ? (isMe ? `You reacted to ${whose}` : 'Reacted to your story')
    : (isMe ? `You replied to ${whose}` : 'Replied to your story')
  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${reply.reaction ? 'mb-4' : 'mb-1'}`}>
      <span className="text-[11.5px] text-[var(--c-text-3)] mb-1 px-1">{label}</span>
      <div className="relative">
        <div className={`w-[112px] aspect-[9/16] rounded-2xl overflow-hidden border border-[var(--c-border)] ${isMe ? 'mr-1' : 'ml-1'}`}>
          {reply.mediaUrl
            ? (reply.mediaType === 'VIDEO'
              ? <video src={`${reply.mediaUrl}#t=0.1`} preload="metadata" muted playsInline className="w-full h-full object-cover" />
              : <img src={reply.mediaUrl} alt="" className="w-full h-full object-cover" />)
            : (
              <div className="w-full h-full p-2.5 flex items-center justify-center" style={{ background: STORY_BACKGROUNDS[reply.background ?? 'harvest'] }}>
                <p className="text-white text-[11px] font-bold text-center leading-tight line-clamp-6" style={{ fontFamily: 'var(--font-display)' }}>{reply.text}</p>
              </div>
            )}
        </div>
        {reply.reaction && (
          <span className={`absolute -bottom-3 ${isMe ? '-left-3' : '-right-3'} text-[34px] leading-none drop-shadow`}>{reply.reaction}</span>
        )}
      </div>
    </div>
  )
}

/**
 * A shared reel as it appears in a chat: a tappable card, as Instagram and
 * TikTok show it, rather than a bare link. A reel deleted after sending leaves
 * a placeholder instead of a card that opens to "not found".
 */
function SharedReelCard({ reel, isMe }: { reel: NonNullable<Message['sharedReel']>; isMe: boolean }) {
  const gone = !reel || reel.status !== 'PUBLISHED'
  if (gone) {
    return (
      <div className={`w-56 rounded-2xl border border-[var(--c-border)] px-4 py-6 text-center text-xs text-[var(--c-text-3)] ${isMe ? 'ml-auto' : ''}`}>
        This reel is no longer available
      </div>
    )
  }
  return (
    <a href={`/reels/${reel._id}`}
      className="block w-56 rounded-2xl overflow-hidden border border-[var(--c-border)] bg-black group">
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--c-card)]">
        <Avatar src={reel.userId?.avatar} name={reel.userId?.name ?? 'Creator'} size="xs" verified={reel.userId?.isVerified} />
        <span className="text-xs font-semibold text-[var(--c-text)] truncate">@{reel.userId?.username}</span>
      </div>
      <div className="relative aspect-[9/16]">
        {reel.thumbnailUrl
          ? <img src={reel.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <video src={`${reel.videoUrl}#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform group-hover:scale-110">
            <Play className="h-6 w-6 fill-white text-white ml-0.5" />
          </span>
        </span>
        {(reel.caption || reel.title) && (
          <p className="absolute bottom-2 left-2.5 right-2.5 text-white text-xs line-clamp-2 drop-shadow">{reel.caption || reel.title}</p>
        )}
      </div>
    </a>
  )
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

/**
 * Sent → delivered → read, plus the pending state before the server has
 * confirmed anything. A single grey tick previously covered everything from
 * "still uploading" to "sitting unread on their phone", which tells a seller
 * chasing a shipment nothing useful.
 */
function MessageTicks({ msg }: { msg: Message }) {
  if (msg.pending) return <Clock className="h-3 w-3 text-[var(--c-text-4)]" aria-label="Sending" />
  if (msg.readAt) return <CheckCheck className="h-3 w-3 text-brand-green" aria-label="Read" />
  if (msg.deliveredAt) return <CheckCheck className="h-3 w-3 text-[var(--c-text-4)]" aria-label="Delivered" />
  return <Check className="h-3 w-3 text-[var(--c-text-4)]" aria-label="Sent" />
}

// Append a message only if it isn't already in the list. The backend broadcasts
// 'message:new' to the whole conversation room — including the sender — so without
// this the sender would see their own message twice (once optimistically, once echoed).
//
// The saved copy of your own message can arrive over the socket before the
// send request itself answers. It carries the clientId of the "sending…" copy
// already on screen, so it replaces that copy in place; appending it instead
// showed the message twice until the request finished.
const appendUnique = (old: Message[] = [], m: Message) => {
  if (old.some(x => x._id === m._id)) return m.clientId ? old.filter(x => x._id !== m.clientId) : old
  if (m.clientId) {
    const i = old.findIndex(x => x._id === m.clientId)
    if (i !== -1) return [...old.slice(0, i), m, ...old.slice(i + 1)]
  }
  return [...old, m]
}

export default function Thread() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [text, setText] = useState('')
  // Minted before each send so the request and its "sending…" copy share it.
  const nextClientId = useRef('')
  const [peerTyping, setPeerTyping] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingSentRef = useRef(false)
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peerTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      // Marking the thread read is a side effect, not part of loading it. It used
      // to be awaited inside this queryFn, so any failure there — a network blip,
      // a 403 — rejected the whole query and the conversation rendered as empty,
      // which reads as "chat is broken" rather than "the read receipt failed".
      api.put(`/messages/${id}/read`)
        .then(() => {
          void refreshUnreadMessages()
          queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
        })
        .catch(() => {})
      return res.data.data
    },
    enabled: !isNewConvo && !!id,
  })

  // Register this conversation as "currently being viewed" so the global
  // notification handler doesn't bump the unread badge/play a sound for
  // messages arriving in the thread the user is already looking at.
  useEffect(() => {
    if (isNewConvo || !id) return
    useUnreadStore.getState().setActiveConversationId(id)
    return () => useUnreadStore.getState().setActiveConversationId(null)
  }, [id, isNewConvo])

  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Conversation[]>>('/messages')
      return res.data.data
    },
  })

  const conversation = conversations?.find(c => c._id === id)
  // Resolve the counterpart by elimination, and never guess. The previous
  // `?? participants[0]` fallback fired whenever the signed-in id was not yet
  // known — during store rehydration, for instance — and participants[0] is the
  // account that opened the conversation, i.e. usually you. That is how a thread
  // ended up showing your own name and avatar as the person you were writing to.
  // With no id to compare against, showing nothing is correct; showing the wrong
  // person is not.
  const conversationOther = user?._id
    ? conversation?.participants.find(p => String(p._id) !== String(user._id))
    : undefined
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
        { conversationId: id, content, clientId: nextClientId.current }
      )
      return res.data.data
    },
    // Show the message the instant it is typed, marked pending, and swap in the
    // saved copy when the server answers. On a slow connection the alternative
    // is a composer that clears with nothing visibly happening.
    onMutate: (content: string) => {
      if (isNewConvo || !user?._id) return
      const optimistic: Message = {
        _id: nextClientId.current,
        senderId: user._id,
        content,
        createdAt: new Date().toISOString(),
        pending: true,
      }
      queryClient.setQueryData(['messages', id], (old: Message[] = []) => [...old, optimistic])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      return { optimisticId: optimistic._id }
    },
    onError: (_err, _vars, ctx) => {
      // Drop the optimistic copy rather than leaving a message that looks sent.
      if (ctx?.optimisticId) {
        queryClient.setQueryData(['messages', id], (old: Message[] = []) =>
          old.filter(m => m._id !== ctx.optimisticId))
      }
    },
    onSuccess: (data, _vars, ctx) => {
      if (isNewConvo) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        navigate(`/messages/${data.conversationId}`, { replace: true })
      } else {
        // Replaces the "sending…" copy in place (or does nothing if the socket
        // already did), so the message never shows twice.
        queryClient.setQueryData(['messages', id], (old: Message[] = []) => appendUnique(old, { ...data.message, clientId: ctx?.optimisticId }))
        // Only the recipient receives 'notification:new', so nothing else would
        // tell the sender's own inbox that this thread just moved to the top
        // with a new last line.
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        setText('')
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    },
  })

  useEffect(() => {
    if (!user?._id || !id || isNewConvo) return
    const socket = getSocket()
    socket.emit('join_conversation', id)
    socket.on('message:new', (msg: Message) => {
      queryClient.setQueryData(['messages', id], (old: Message[] = []) => appendUnique(old, msg))
      // It is on screen, so it has arrived — and, since you are looking at it,
      // been read. Marking it read here also clears its notification, which
      // otherwise added one to the bell for every message received mid-chat.
      if (getSenderId(msg) !== user._id) {
        socket.emit('message:delivered', { conversationId: id })
        api.put(`/messages/${id}/read`)
          .then(() => {
            void refreshUnreadMessages()
            queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
          })
          .catch(() => {})
      }
      // Keeps the list beside the thread (desktop split-pane) in step with it.
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
    socket.on('message:read', ({ readerId, readAt }: { readerId: string; readAt: string }) => {
      // The other participant just read our messages — flip the tick to "read"
      // live instead of waiting for this client's next refetch.
      if (readerId === user._id) return
      queryClient.setQueryData(['messages', id], (old: Message[] = []) =>
        old.map(m => (getSenderId(m) === user._id && !m.readAt) ? { ...m, readAt } : m)
      )
    })
    socket.on('message:delivered', ({ deliveredTo, deliveredAt }: { deliveredTo: string; deliveredAt: string }) => {
      if (deliveredTo === user._id) return
      queryClient.setQueryData(['messages', id], (old: Message[] = []) =>
        old.map(m => (getSenderId(m) === user._id && !m.deliveredAt) ? { ...m, deliveredAt } : m)
      )
    })
    socket.on('typing', ({ userId: who, name, isTyping }: { userId: string; name?: string; isTyping: boolean }) => {
      if (who === user._id) return
      if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current)
      if (!isTyping) { setPeerTyping(null); return }
      setPeerTyping(name || 'Typing')
      // Safety net: if the other client disconnects mid-sentence its stop event
      // never arrives, and the indicator would otherwise hang there forever.
      peerTypingTimeoutRef.current = setTimeout(() => setPeerTyping(null), 6000)
    })

    // Confirm arrival of anything already on screen from the other party.
    socket.emit('message:delivered', { conversationId: id })

    return () => {
      socket.off('message:new'); socket.off('message:read')
      socket.off('message:delivered'); socket.off('typing')
      if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current)
      socket.emit('leave_conversation', id)
    }
  }, [id, user?._id, isNewConvo, queryClient])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  // Starting a thread requires knowing who it is with. Reaching /messages/new
  // without a recipientId used to still send: the param comes back as null from
  // URLSearchParams and the server accepted it, creating a conversation with no
  // second participant that could never be delivered.
  const canSend = isNewConvo ? Boolean(recipientIdParam) : Boolean(id)

  /**
   * Emit typing on the first keystroke and stop after a pause, rather than one
   * event per character — a chatty seller would otherwise put a socket message
   * on the wire for every letter typed.
   */
  const signalTyping = () => {
    if (isNewConvo || !id) return
    const socket = getSocket()
    if (!typingSentRef.current) {
      typingSentRef.current = true
      socket.emit('typing', { conversationId: id, isTyping: true })
    }
    if (typingStopRef.current) clearTimeout(typingStopRef.current)
    typingStopRef.current = setTimeout(() => {
      typingSentRef.current = false
      socket.emit('typing', { conversationId: id, isTyping: false })
    }, 2500)
  }

  const stopTyping = () => {
    if (isNewConvo || !id || !typingSentRef.current) return
    if (typingStopRef.current) clearTimeout(typingStopRef.current)
    typingSentRef.current = false
    getSocket().emit('typing', { conversationId: id, isTyping: false })
  }

  const handleSend = () => {
    stopTyping()
    if (!text.trim() || sendMutation.isPending || !canSend) return
    nextClientId.current = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
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
    <div className="flex flex-col h-full w-full bg-[var(--c-bg)]">
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
          {peerTyping ? (
            <p className="text-brand-green text-xs font-medium flex items-center gap-1">
              {peerTyping} is typing
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-brand-green animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-brand-green animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-brand-green animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </p>
          ) : other?.username ? (
            <p className="text-[var(--c-text-4)] text-xs">@{other.username}</p>
          ) : null}
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
                  {msg.sharedReel !== undefined && (
                    <SharedReelCard reel={msg.sharedReel as any} isMe={isMe} />
                  )}
                  {msg.storyReply && (
                    <StoryReplyCard reply={msg.storyReply} isMe={isMe} otherName={other?.name?.split(' ')[0]} />
                  )}
                  {/* A shared reel may travel with no note; draw no empty bubble. */}
                  {Boolean(msg.content) && (
                  <div
                    className={`
                      px-4 py-2.5 text-sm leading-relaxed break-words ${msg.sharedReel || msg.storyReply?.reaction ? 'mt-3' : ''}
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
                  )}

                  {isLast && (
                    <div className={`flex items-center gap-1 mt-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[var(--c-text-4)] text-[10px]">{formatTime(msg.createdAt)}</span>
                      {isMe && <MessageTicks msg={msg} />}
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
              onChange={e => { setText(e.target.value); signalTyping() }}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={!canSend}
              placeholder={canSend ? `Message ${other?.name ?? ''}…` : 'Pick someone to message first'}
              className="flex-1 bg-transparent py-2.5 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending || !canSend}
            className="w-10 h-10 rounded-full bg-brand-green flex items-center justify-center text-white disabled:opacity-40 hover:bg-brand-emerald transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
