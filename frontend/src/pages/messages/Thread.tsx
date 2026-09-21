import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Phone, Video, Check, CheckCheck, Clock, Play, X, Undo2, Reply, Pencil } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { ReelThumb } from '@/components/reels/ReelThumb'
import { MessageMenu, GestureRow, useMessageSheet, type MessageAction } from '@/components/messages/MessageActions'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import { useUnreadStore } from '@/store/unreadStore'
import { refreshUnreadMessages } from '@/hooks/useUnreadMessages'
import { getSocket } from '@/lib/socket'
import api from '@/lib/api'
import { STORY_BACKGROUNDS, useStoryUI, type StoryBackground, type StoryGroup } from '@/lib/stories'
import type { ApiResponse, Product, User } from '@/types'

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
  /** Unsent by its author. The server sends no text with it, only the fact. */
  recalledAt?: string
  /** Last edited at; the content field already holds the current wording. */
  editedAt?: string
  /** The message this one answers, quoted above it. */
  replyTo?: {
    _id: string; content?: string; mediaUrl?: string; recalledAt?: string
    senderId?: { _id: string; name?: string; username?: string } | string
  } | null
  /** The sender's own id for this message; ties the saved copy to its "sending…" copy. */
  clientId?: string
  /** A reel sent from its share sheet. Null if it has since been removed. */
  sharedReel?: {
    _id: string; thumbnailUrl?: string; videoUrl?: string; caption?: string; title?: string
    status?: string; viewCount?: number; userId?: User
  } | null
  /** The listing a question was asked about, from a product's "Ask" button. */
  sharedProduct?: Pick<Product, '_id' | 'title' | 'slug' | 'images' | 'price' | 'priceUnit' | 'status'> | null
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
  const openViewer = useStoryUI(s => s.openViewer)
  const [checking, setChecking] = useState(false)
  const whose = `${otherName ?? 'their'}'s story`

  /**
   * The card carries its own snapshot so an old conversation still makes
   * sense, but a story that is still up is worth opening properly — video,
   * attached produce, the lot. The snapshot is the fallback, not the target.
   */
  const open = async () => {
    if (checking) return
    setChecking(true)
    try {
      const res = await api.get<ApiResponse<StoryGroup>>(`/stories/${reply.storyId}`)
      if (res.data.data?.stories?.length) openViewer([res.data.data])
    } catch {
      // Expired, deleted, or no longer visible to us: the snapshot stays.
    } finally { setChecking(false) }
  }
  const label = reply.reaction
    ? (isMe ? `You reacted to ${whose}` : 'Reacted to your story')
    : (isMe ? `You replied to ${whose}` : 'Replied to your story')
  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${reply.reaction ? 'mb-4' : 'mb-1'}`}>
      <span className="text-[11.5px] text-[var(--c-text-3)] mb-1 px-1">{label}</span>
      <div className="relative">
        <button onClick={open} aria-label="Open this story"
          className={`block w-[112px] aspect-[9/16] rounded-2xl overflow-hidden border border-[var(--c-border)] press ${isMe ? 'mr-1' : 'ml-1'} ${checking ? 'opacity-60' : ''}`}>
          {reply.mediaUrl
            ? (reply.mediaType === 'VIDEO'
              ? <video src={`${reply.mediaUrl}#t=0.1`} preload="metadata" muted playsInline className="w-full h-full object-cover" />
              : <img src={reply.mediaUrl} alt="" className="w-full h-full object-cover" />)
            : (
              <div className="w-full h-full p-2.5 flex items-center justify-center" style={{ background: STORY_BACKGROUNDS[reply.background ?? 'harvest'] }}>
                <p className="text-white text-[11px] font-bold text-center leading-tight line-clamp-6" style={{ fontFamily: 'var(--font-display)' }}>{reply.text}</p>
              </div>
            )}
        </button>
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
        {/* Stored thumbnail, else a frame Cloudinary cuts from the video: an
            iPhone will not paint one from an unplayed <video>, so without
            this a shared reel arrived as an empty black card. */}
        <ReelThumb thumbnailUrl={reel.thumbnailUrl} videoUrl={reel.videoUrl} className="absolute inset-0 w-full h-full" />
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

/**
 * The listing a question is about, shown with the question itself. A seller
 * with a dozen products cannot answer "is this still available?" without it.
 */
function SharedProductCard({ product, isMe }: { product: Message['sharedProduct']; isMe: boolean }) {
  if (!product) {
    return (
      <div className={`w-56 rounded-2xl border border-[var(--c-border)] px-4 py-5 text-center text-xs text-[var(--c-text-3)] ${isMe ? 'ml-auto' : ''}`}>
        This listing is no longer available
      </div>
    )
  }
  return (
    <a href={`/marketplace/product/${product.slug}`}
      className="flex items-center gap-2.5 w-[230px] p-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] press">
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--c-input)] shrink-0">
        {product.images?.[0] && <img src={product.images[0]} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--c-text)] truncate">{product.title}</p>
        <p className="text-[12px] font-semibold text-brand-green tabular">
          TZS {product.price?.toLocaleString()}
          <span className="font-normal text-[var(--c-text-4)]"> / {product.priceUnit}</span>
        </p>
      </div>
    </a>
  )
}

/** How long a sender has to take a message back or fix it. Mirrors the server. */
const EDIT_WINDOW_MS = 60_000

const withinWindow = (msg: Message) => Date.now() - new Date(msg.createdAt).getTime() < EDIT_WINDOW_MS

/**
 * The line a reply is answering, sitting above it as WhatsApp shows it.
 * Tapping it jumps to the original, which is the whole point of quoting:
 * "which of the four prices do you mean" has an answer you can get to.
 */
function QuotedMessage({ reply, isMe, myId, onJump }: {
  reply: NonNullable<Message['replyTo']>; isMe: boolean; myId?: string; onJump: () => void
}) {
  const sender = typeof reply.senderId === 'object' ? reply.senderId : undefined
  const who = sender?._id === myId ? 'You' : (sender?.name?.split(' ')[0] ?? 'Them')
  const body = reply.recalledAt ? 'Message recalled' : (reply.content || (reply.mediaUrl ? 'Photo' : ''))
  // Lives inside the bubble it belongs to, tinted against that bubble — it was
  // drawn above it on the page background with styles meant for a green
  // bubble, which left near-white text on white.
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onJump() }}
      className={`mb-1.5 block w-full rounded-xl px-2.5 py-1.5 text-left ${
        isMe ? 'bg-black/15 active:bg-black/25' : 'bg-[var(--c-input)] active:bg-[var(--c-raised)]'}`}>
      <span className={`block text-[12px] font-semibold ${isMe ? 'text-white' : 'text-brand-green'}`}>{who}</span>
      <span className={`block text-[13px] leading-snug line-clamp-2 ${
        isMe ? 'text-white/90' : 'text-[var(--c-text-2)]'} ${reply.recalledAt ? 'italic' : ''}`}>{body}</span>
    </button>
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

  // Marking read has to also refresh the inbox: it shows its own per-thread
  // unread count, and without this it kept saying "3 new messages" on a
  // conversation that had just been read — including story reactions, which
  // arrive while the reader is somewhere else entirely.
  const markThreadRead = useCallback((convId: string) => {
    api.put(`/messages/${convId}/read`)
      .then(() => {
        void refreshUnreadMessages()
        queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })
      .catch(() => {})
  }, [queryClient])

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

  // "Ask" on a listing arrives with ?productId=..., so the question travels
  // with its subject attached. Dismissible: a thread may wander off the
  // product, and the attachment is spent once the question is sent.
  const productIdParam = searchParams.get('productId')
  const stateProduct = (location.state as { product?: Product } | null)?.product
  const [dropped, setDropped] = useState(false)
  // What the composer is currently doing: writing a new line, answering one,
  // or rewriting one that has already been sent.
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  // A short line above the composer, for when an edit or recall is refused.
  const [notice, setNotice] = useState<string | null>(null)
  const { openSheet, sheetNode } = useMessageSheet()
  const { data: fetchedProduct } = useQuery({
    queryKey: ['product-by-id', productIdParam],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product>>(`/products/${productIdParam}`)
      return res.data.data
    },
    enabled: !!productIdParam && !stateProduct && !dropped,
  })
  const attachedProduct = dropped ? undefined : (stateProduct ?? fetchedProduct)

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Message[]>>(`/messages/${id}`)
      // Marking the thread read is a side effect, not part of loading it: it
      // used to be awaited inside this queryFn, so any failure there — a
      // network blip, a 403 — rejected the whole query and the conversation
      // rendered as empty, which reads as "chat is broken" rather than "the
      // read receipt failed". The effect below owns it now, so a thread served
      // from cache is marked read as well as one that was just fetched.
      return res.data.data
    },
    enabled: !isNewConvo && !!id,
  })

  // Anything on screen is read. Keyed on the message count so reopening a
  // cached thread, where the query never refetches, still clears its badge.
  useEffect(() => {
    if (isNewConvo || !id || !messages?.length) return
    if (!messages.some(m => getSenderId(m) !== user?._id && !m.readAt)) return
    markThreadRead(id)
  }, [id, isNewConvo, messages, user?._id, markThreadRead])

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

  // Every "Message"/"Ask" button lands on /messages/new, but there is usually
  // already a thread with that person. Without this their history only appeared
  // after the first message was sent — the conversation looked empty at exactly
  // the moment its context mattered most.
  const existingWithRecipient = isNewConvo && recipientIdParam
    ? conversations?.find(c => c.participants.some(p => String(p._id) === recipientIdParam))
    : undefined
  useEffect(() => {
    if (!existingWithRecipient) return
    navigate(`/messages/${existingWithRecipient._id}${location.search}`, { replace: true, state: location.state })
  }, [existingWithRecipient?._id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    mutationFn: async ({ content, replyTo }: { content: string; replyTo?: Message | null }) => {
      if (isNewConvo) {
        const res = await api.post<ApiResponse<{ message: Message; conversationId: string }>>(
          '/messages',
          { recipientId: recipientIdParam, content, productId: attachedProduct?._id, replyTo: replyTo?._id }
        )
        return res.data.data
      }
      const res = await api.post<ApiResponse<{ message: Message; conversationId: string }>>(
        '/messages',
        { conversationId: id, content, clientId: nextClientId.current, productId: attachedProduct?._id, replyTo: replyTo?._id }
      )
      return res.data.data
    },
    // Show the message the instant it is typed, marked pending, and swap in the
    // saved copy when the server answers. On a slow connection the alternative
    // is a composer that clears with nothing visibly happening.
    onMutate: ({ content, replyTo }: { content: string; replyTo?: Message | null }) => {
      if (isNewConvo || !user?._id) return
      const optimistic: Message = {
        _id: nextClientId.current,
        senderId: user._id,
        content,
        createdAt: new Date().toISOString(),
        pending: true,
        ...(attachedProduct ? { sharedProduct: attachedProduct } : {}),
        ...(replyTo ? {
          replyTo: {
            _id: replyTo._id, content: replyTo.content, mediaUrl: replyTo.mediaUrl,
            senderId: typeof replyTo.senderId === 'object' ? replyTo.senderId : { _id: replyTo.senderId },
          },
        } : {}),
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
        setDropped(true)
        navigate(`/messages/${data.conversationId}`, { replace: true })
      } else {
        // Replaces the "sending…" copy in place (or does nothing if the socket
        // already did), so the message never shows twice.
        queryClient.setQueryData(['messages', id], (old: Message[] = []) => appendUnique(old, { ...data.message, clientId: ctx?.optimisticId }))
        // Only the recipient receives 'notification:new', so nothing else would
        // tell the sender's own inbox that this thread just moved to the top
        // with a new last line.
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        setDropped(true)
        setReplyingTo(null)
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
        markThreadRead(id)
      }
      // Keeps the list beside the thread (desktop split-pane) in step with it.
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
    // A story reaction taken back: drop it here too, or the owner keeps
    // looking at a heart the sender has already removed.
    socket.on('message:removed', ({ messageId }: { messageId: string }) => {
      queryClient.setQueryData(['messages', id], (old: Message[] = []) => old.filter(m => m._id !== messageId))
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })
    socket.on('message:recalled', ({ messageId, recalledAt }: { messageId: string; recalledAt: string }) => {
      queryClient.setQueryData(['messages', id], (old: Message[] = []) =>
        old.map(m => m._id === messageId ? { ...m, recalledAt, content: '', mediaUrl: undefined, sharedProduct: undefined } : m))
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })
    socket.on('message:edited', ({ messageId, content, editedAt }: { messageId: string; content: string; editedAt: string }) => {
      queryClient.setQueryData(['messages', id], (old: Message[] = []) =>
        old.map(m => m._id === messageId ? { ...m, content, editedAt } : m))
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
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
      socket.off('message:new'); socket.off('message:read'); socket.off('message:removed')
      socket.off('message:recalled'); socket.off('message:edited')
      socket.off('message:delivered'); socket.off('typing')
      if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current)
      socket.emit('leave_conversation', id)
    }
  }, [id, user?._id, isNewConvo, queryClient])

  // Follow the conversation down only when you are already at the bottom of
  // it, or on first open. Scrolling on every change meant a read receipt or an
  // edit arriving yanked you back down from whatever you had scrolled up to
  // read, or had just jumped to from a quote.
  const listRef = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const lastCount = useRef(0)
  useEffect(() => { lastCount.current = 0; atBottom.current = true }, [id])
  // The reply, edit and notice strips make the composer taller; if you were
  // reading the latest message, keep it in view rather than half behind them.
  const composerMode = `${replyingTo?._id ?? ''}|${editing?._id ?? ''}|${notice ?? ''}`
  useEffect(() => {
    if (atBottom.current) requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }, [composerMode])
  useEffect(() => {
    const count = messages?.length ?? 0
    const first = lastCount.current === 0 && count > 0
    const grew = count > lastCount.current
    lastCount.current = count
    if (first) bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    else if (grew && atBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  /** Unsend, and let the other side know it happened rather than vanish. */
  const flashNotice = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(null), 3200) }

  const recall = async (msg: Message) => {
    // The sheet was built when it opened; the minute may have run out since.
    if (!withinWindow(msg)) { flashNotice('Messages can only be recalled within a minute of sending'); return }
    queryClient.setQueryData(['messages', id], (old: Message[] = []) =>
      old.map(m => m._id === msg._id ? { ...m, recalledAt: new Date().toISOString(), content: '' } : m))
    try {
      await api.post(`/messages/message/${msg._id}/recall`)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (err: any) {
      // Put it back: the window may have closed on the way to the server.
      queryClient.invalidateQueries({ queryKey: ['messages', id] })
      flashNotice(err?.response?.data?.message ?? 'Could not recall that message')
    }
  }

  const saveEdit = async (msg: Message, content: string) => {
    if (!withinWindow(msg)) {
      setEditing(null); setText('')
      flashNotice('Messages can only be edited within a minute of sending')
      return
    }
    const before = msg.content
    queryClient.setQueryData(['messages', id], (old: Message[] = []) =>
      old.map(m => m._id === msg._id ? { ...m, content, editedAt: new Date().toISOString() } : m))
    setEditing(null); setText('')
    try {
      await api.patch(`/messages/message/${msg._id}`, { content })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (err: any) {
      queryClient.setQueryData(['messages', id], (old: Message[] = []) =>
        old.map(m => m._id === msg._id ? { ...m, content: before } : m))
      flashNotice(err?.response?.data?.message ?? 'Could not save the edit')
    }
  }

  /** Scroll a quoted message into view and flash it, so the eye can find it. */
  const jumpTo = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-brand-green', 'rounded-2xl')
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-brand-green', 'rounded-2xl'), 1400)
  }

  const startReply = (msg: Message) => {
    setEditing(null)
    setReplyingTo(msg)
    inputRef.current?.focus()
  }

  /** What this particular message offers, given who sent it and how long ago. */
  const actionsFor = (msg: Message, isMe: boolean): MessageAction[] => {
    if (msg.recalledAt || msg.pending) return []
    const list: MessageAction[] = [
      { key: 'reply', label: 'Reply', run: () => startReply(msg) },
    ]
    if (msg.content) {
      list.push({ key: 'copy', label: 'Copy', run: () => { void navigator.clipboard?.writeText(msg.content) } })
    }
    if (isMe && withinWindow(msg)) {
      if (msg.content) {
        list.push({ key: 'edit', label: 'Edit', run: () => { setReplyingTo(null); setEditing(msg); setText(msg.content); inputRef.current?.focus() } })
      }
      list.push({ key: 'recall', label: 'Recall', danger: true, run: () => void recall(msg) })
    }
    return list
  }

  const handleSend = () => {
    stopTyping()
    if (!text.trim()) return
    if (editing) { void saveEdit(editing, text.trim()); return }
    if (sendMutation.isPending || !canSend) return
    nextClientId.current = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    sendMutation.mutate({ content: text.trim(), replyTo: replyingTo })
    setReplyingTo(null)
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
    <div className="flex flex-col h-full min-h-0 w-full bg-[var(--c-bg)]">
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
      <div ref={listRef} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-4 py-4 space-y-0.5"
        onScroll={e => {
          const el = e.currentTarget
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}>
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
          grouped.map(({ msg, isMe, prevSame, isLast, showDay }) => {
            const actions = actionsFor(msg, isMe)
            return (
            <div key={msg._id} id={`msg-${msg._id}`} className="transition-shadow">
              {showDay && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[var(--c-border)]" />
                  <span className="text-[var(--c-text-4)] text-xs font-medium px-2">{formatDay(msg.createdAt)}</span>
                  <div className="flex-1 h-px bg-[var(--c-border)]" />
                </div>
              )}

              <GestureRow
                className={prevSame ? 'mt-0.5' : 'mt-3'}
                onReply={actions.some(a => a.key === 'reply') ? () => startReply(msg) : undefined}
                onLongPress={actions.length ? () => openSheet(actions) : undefined}>
              <div className={`group/msg flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {isMe && <MessageMenu actions={actions} isMe />}
                {!isMe && (
                  <div className="w-7 shrink-0">
                    {isLast ? (
                      <Avatar src={other?.avatar} name={other?.name} size="xs" verified={other?.isVerified} />
                    ) : null}
                  </div>
                )}

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[78%] sm:max-w-[72%]`}>
                  {msg.sharedReel !== undefined && (
                    <SharedReelCard reel={msg.sharedReel as any} isMe={isMe} />
                  )}
                  {msg.sharedProduct !== undefined && (
                    <SharedProductCard product={msg.sharedProduct} isMe={isMe} />
                  )}
                  {msg.storyReply && (
                    <StoryReplyCard reply={msg.storyReply} isMe={isMe} otherName={other?.name?.split(' ')[0]} />
                  )}
                  {msg.recalledAt && (
                    <div className="flex items-center gap-1.5 rounded-2xl border border-[var(--c-border)] px-3.5 py-2 text-[13px] italic text-[var(--c-text-3)]">
                      <Undo2 className="h-3.5 w-3.5" />
                      {isMe ? 'You recalled this message' : 'This message was recalled'}
                    </div>
                  )}
                  {/* A shared reel may travel with no note; draw no empty bubble. */}
                  {Boolean(msg.content) && (
                  <div
                    className={`
                      ${msg.replyTo && !msg.recalledAt ? 'p-1.5 pb-2' : 'px-3.5 py-2'} text-[14.5px] leading-snug break-words whitespace-pre-wrap ${msg.sharedReel || msg.storyReply?.reaction ? 'mt-3' : ''} ${msg.sharedProduct !== undefined ? 'mt-1.5' : ''}
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
                    {/* A recalled message takes its quote with it. */}
                    {msg.replyTo && !msg.recalledAt && (
                      <QuotedMessage reply={msg.replyTo} isMe={isMe} myId={user?._id}
                        onJump={() => jumpTo(msg.replyTo!._id)} />
                    )}
                    <span className={msg.replyTo && !msg.recalledAt ? 'block px-2' : undefined}>{msg.content}</span>
                  </div>
                  )}

                  {isLast && (
                    <div className={`flex items-center gap-1 mt-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[var(--c-text-4)] text-[10px]">{formatTime(msg.createdAt)}</span>
                      {msg.editedAt && !msg.recalledAt && <span className="text-[var(--c-text-4)] text-[10px]">edited</span>}
                      {isMe && !msg.recalledAt && <MessageTicks msg={msg} />}
                    </div>
                  )}
                </div>
                {!isMe && <MessageMenu actions={actions} isMe={false} />}
              </div>
              </GestureRow>
            </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 px-4 py-3 border-t border-[var(--c-border)] bg-[var(--c-card)]">
        {notice && (
          <p role="status" className="max-w-4xl mx-auto mb-2 rounded-xl bg-[var(--c-input)] px-3 py-2 text-center text-[12.5px] text-[var(--c-text-2)]">
            {notice}
          </p>
        )}
        {(replyingTo || editing) && (
          <div className="max-w-4xl mx-auto mb-2 flex items-center gap-3 rounded-2xl bg-[var(--c-input)] py-2 pl-2.5 pr-1.5">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              editing ? 'bg-gold/15 text-gold' : 'bg-brand-green/12 text-brand-green'}`}>
              {editing ? <Pencil className="h-4 w-4" /> : <Reply className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[12px] font-semibold leading-tight ${editing ? 'text-gold' : 'text-brand-green'}`}>
                {editing ? 'Edit message' : `Reply to ${replyingTo && getSenderId(replyingTo) === user?._id ? 'yourself' : (other?.name?.split(' ')[0] ?? 'them')}`}
              </p>
              <p className="truncate text-[13px] text-[var(--c-text-2)]">
                {(editing ?? replyingTo)!.content || 'Photo'}
              </p>
            </div>
            <button onClick={() => { setReplyingTo(null); if (editing) { setEditing(null); setText('') } }}
              aria-label="Cancel"
              className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {attachedProduct && (
          <div className="max-w-4xl mx-auto mb-2.5 flex items-center gap-2.5 p-2 rounded-2xl bg-[var(--c-input)] border border-[var(--c-border)]">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--c-raised)] shrink-0">
              {attachedProduct.images?.[0] && <img src={attachedProduct.images[0]} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-tight text-[var(--c-text-4)]">Asking about</p>
              <p className="text-[13px] font-semibold text-[var(--c-text)] truncate">{attachedProduct.title}</p>
            </div>
            <button onClick={() => setDropped(true)} aria-label="Remove listing"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)] shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <div className="flex-1 flex items-center bg-[var(--c-input)] border border-[var(--c-border)] rounded-full px-4 transition-all focus-within:border-brand-green">
            <input
              ref={inputRef}
              value={text}
              onChange={e => { setText(e.target.value); signalTyping() }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) handleSend()
                if (e.key === 'Escape' && editing) { setEditing(null); setText('') }
              }}
              disabled={!canSend}
              placeholder={!canSend ? 'Pick someone to message first' : editing ? 'Edit your message…' : replyingTo ? 'Reply…' : attachedProduct ? 'Ask about this listing…' : `Message ${other?.name ?? ''}…`}
              className="flex-1 bg-transparent py-2.5 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-[16px] sm:text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending || (!canSend && !editing)}
            className="w-10 h-10 rounded-full bg-brand-green flex items-center justify-center text-white disabled:opacity-40 hover:bg-brand-emerald transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* The long-press sheet, outside the scrolling thread so it is not clipped. */}
      {sheetNode}
    </div>
  )
}
