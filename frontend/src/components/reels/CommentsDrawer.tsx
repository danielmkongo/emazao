import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Heart, Loader2, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/authStore'
import { formatNumber, timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

export interface CommentData {
  _id: string
  userId: User | null
  parentId?: string
  replyToUserId?: { _id: string; username: string } | null
  content: string
  likeCount: number
  replyCount?: number
  userLiked?: boolean
  createdAt: string
}

/** A comment's heart: optimistic, and settles on the server's answer. */
function LikeButton({ comment, onChange }: { comment: CommentData; onChange: (c: CommentData) => void }) {
  const { isAuthenticated } = useAuthStore()
  const pending = useRef(false)
  const toggle = async () => {
    if (!isAuthenticated || pending.current) return
    pending.current = true
    const liked = !comment.userLiked
    onChange({ ...comment, userLiked: liked, likeCount: Math.max(0, comment.likeCount + (liked ? 1 : -1)) })
    try {
      await api.post('/social/like', { targetId: comment._id, targetType: 'Comment' })
    } catch {
      onChange(comment)
    } finally {
      pending.current = false
    }
  }
  return (
    <button onClick={toggle} aria-label={comment.userLiked ? 'Unlike comment' : 'Like comment'} aria-pressed={comment.userLiked}
      className="flex flex-col items-center gap-0.5 pt-1 w-8 shrink-0">
      <motion.span whileTap={{ scale: 1.4 }}>
        <Heart className={`h-3.5 w-3.5 transition-colors ${comment.userLiked ? 'fill-red-500 text-red-500' : 'text-white/40'}`} />
      </motion.span>
      {comment.likeCount > 0 && <span className="text-[10px] text-white/40 tabular-nums">{formatNumber(comment.likeCount)}</span>}
    </button>
  )
}

function CommentRow({
  comment, reelOwnerId, onReply, onChange, onDelete, small,
}: {
  comment: CommentData; reelOwnerId?: string; small?: boolean
  onReply: (c: CommentData) => void
  onChange: (c: CommentData) => void
  onDelete: (c: CommentData) => void
}) {
  const { user } = useAuthStore()
  const author = comment.userId
  const canDelete = user && (String(author?._id) === String(user._id) || String(reelOwnerId) === String(user._id))
  return (
    <div className="flex items-start gap-2.5 group">
      <Avatar src={author?.avatar} name={author?.name ?? 'User'} size={small ? 'xs' : 'sm'} />
      <div className="flex-1 min-w-0">
        <p className="text-white/55 text-xs font-semibold">
          {author?.username ?? 'user'}
          <span className="text-white/30 font-normal ml-2">{timeAgo(comment.createdAt)}</span>
        </p>
        <p className="text-white text-sm leading-snug break-words mt-0.5">
          {comment.replyToUserId?.username && (
            <span className="text-brand-lime font-medium mr-1">@{comment.replyToUserId.username}</span>
          )}
          {comment.content}
        </p>
        <div className="flex items-center gap-4 mt-1.5">
          <button onClick={() => onReply(comment)} className="text-white/40 hover:text-white/80 text-xs font-semibold">Reply</button>
          {canDelete && (
            <button onClick={() => onDelete(comment)} aria-label="Delete comment"
              className="text-white/30 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
      </div>
      <LikeButton comment={comment} onChange={onChange} />
    </div>
  )
}

/** A top-level comment and its thread, which loads only when asked for. */
function Thread({
  reelId, comment, reelOwnerId, onReply, onChangeTop, onDelete, expandSignal,
}: {
  reelId: string; comment: CommentData; reelOwnerId?: string
  onReply: (c: CommentData) => void
  onChangeTop: (c: CommentData) => void
  onDelete: (c: CommentData) => void
  expandSignal: number
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  // Posting a reply to this thread opens it, so you see where your reply went.
  useEffect(() => { if (expandSignal) setOpen(true) }, [expandSignal])

  const { data: replies = [], isFetching } = useQuery({
    queryKey: ['comment-replies', comment._id],
    queryFn: async () => (await api.get<ApiResponse<CommentData[]>>(`/reels/${reelId}/comments/${comment._id}/replies`)).data.data ?? [],
    enabled: open,
  })
  const setReply = (c: CommentData) =>
    queryClient.setQueryData(['comment-replies', comment._id], (old: CommentData[] = []) => old.map(r => (r._id === c._id ? c : r)))

  const count = comment.replyCount ?? 0
  return (
    <div>
      <CommentRow comment={comment} reelOwnerId={reelOwnerId} onReply={onReply} onChange={onChangeTop} onDelete={onDelete} />
      {count > 0 && (
        <div className="pl-11 mt-2">
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-xs font-semibold">
            <span className="w-6 h-px bg-white/25" />
            {open ? 'Hide replies' : `View ${count} ${count === 1 ? 'reply' : 'replies'}`}
            {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="space-y-3 mt-3 overflow-hidden">
                {replies.map(r => (
                  <CommentRow key={r._id} comment={r} small reelOwnerId={reelOwnerId}
                    onReply={onReply} onChange={setReply} onDelete={onDelete} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export function CommentsDrawer({
  reelId, reelOwnerId, count, onClose, onCountChange,
}: {
  reelId: string; reelOwnerId?: string; count: number; onClose: () => void
  onCountChange: (delta: number) => void
}) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<CommentData | null>(null)
  const [expand, setExpand] = useState<Record<string, number>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const key = ['reel-comments', reelId]

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: key,
    queryFn: async ({ pageParam }) => {
      const res = await api.get<ApiResponse<CommentData[]> & { nextPage: number | null }>(`/reels/${reelId}/comments?page=${pageParam}`)
      return { items: res.data.data ?? [], next: res.data.nextPage }
    },
    initialPageParam: 1,
    getNextPageParam: last => last.next ?? undefined,
  })
  const comments = data?.pages.flatMap(p => p.items) ?? []

  const patchTop = (c: CommentData) => queryClient.setQueryData(key, (old: any) => old && ({
    ...old, pages: old.pages.map((p: any) => ({ ...p, items: p.items.map((x: CommentData) => (x._id === c._id ? c : x)) })),
  }))

  const post = useMutation({
    mutationFn: async () => (await api.post<ApiResponse<CommentData>>(`/reels/${reelId}/comments`, {
      content: text.trim(), parentId: replyTo?._id,
    })).data.data,
    onSuccess: created => {
      if (!created) return
      onCountChange(1)
      if (created.parentId) {
        // Add to the thread and bump its "View N replies".
        queryClient.setQueryData(['comment-replies', created.parentId], (old: CommentData[] = []) => [...old, created])
        queryClient.setQueryData(key, (old: any) => old && ({
          ...old, pages: old.pages.map((p: any) => ({
            ...p, items: p.items.map((x: CommentData) => x._id === created.parentId ? { ...x, replyCount: (x.replyCount ?? 0) + 1 } : x),
          })),
        }))
        setExpand(e => ({ ...e, [created.parentId!]: Date.now() }))
      } else {
        queryClient.setQueryData(key, (old: any) => old
          ? { ...old, pages: [{ ...old.pages[0], items: [created, ...old.pages[0].items] }, ...old.pages.slice(1)] }
          : { pages: [{ items: [created], next: null }], pageParams: [1] })
      }
      setText('')
      setReplyTo(null)
    },
  })

  const remove = useMutation({
    mutationFn: async (c: CommentData) => (await api.delete<ApiResponse<{ removed: number }>>(`/reels/${reelId}/comments/${c._id}`)).data.data,
    onSuccess: (res, c) => {
      onCountChange(-(res?.removed ?? 1))
      if (c.parentId) {
        queryClient.setQueryData(['comment-replies', c.parentId], (old: CommentData[] = []) => old.filter(r => r._id !== c._id))
        queryClient.setQueryData(key, (old: any) => old && ({
          ...old, pages: old.pages.map((p: any) => ({
            ...p, items: p.items.map((x: CommentData) => x._id === c.parentId ? { ...x, replyCount: Math.max(0, (x.replyCount ?? 1) - 1) } : x),
          })),
        }))
      } else {
        queryClient.setQueryData(key, (old: any) => old && ({
          ...old, pages: old.pages.map((p: any) => ({ ...p, items: p.items.filter((x: CommentData) => x._id !== c._id) })),
        }))
      }
    },
  })

  const startReply = (c: CommentData) => {
    setReplyTo(c)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute inset-x-0 bottom-0 bg-[#0e1411]/[0.97] backdrop-blur-xl rounded-t-3xl z-30 flex flex-col"
      style={{ maxHeight: '72%' }}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex justify-center pt-2.5"><span className="w-10 h-1 rounded-full bg-white/20" /></div>
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <h3 className="font-semibold text-white text-sm">{formatNumber(count)} comments</h3>
        <button onClick={onClose} aria-label="Close comments" className="text-white/60 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 min-h-0">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
        ) : !comments.length ? (
          <div className="text-center py-10">
            <p className="text-white font-semibold">No comments yet</p>
            <p className="text-white/40 text-sm mt-1">Start the conversation.</p>
          </div>
        ) : (
          <>
            {comments.map(c => (
              <Thread key={c._id} reelId={reelId} comment={c} reelOwnerId={reelOwnerId}
                onReply={startReply} onChangeTop={patchTop} onDelete={cm => remove.mutate(cm)}
                expandSignal={expand[c._id] ?? 0} />
            ))}
            {hasNextPage && (
              <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                className="w-full text-center text-white/50 hover:text-white/80 text-xs font-semibold py-2">
                {isFetchingNextPage ? 'Loading…' : 'Load more comments'}
              </button>
            )}
          </>
        )}
      </div>

      {user ? (
        <div className="border-t border-white/10">
          <AnimatePresence>
            {replyTo && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="flex items-center justify-between px-4 py-2 bg-white/5 text-xs text-white/60 overflow-hidden">
                <span>Replying to <span className="text-white font-semibold">@{replyTo.userId?.username ?? 'user'}</span></span>
                <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="hover:text-white"><X className="h-3.5 w-3.5" /></button>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="px-4 py-3 flex items-center gap-3">
            <Avatar src={user.avatar} name={user.name} size="xs" />
            <input
              ref={inputRef}
              id="comment-input"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && text.trim() && !post.isPending) post.mutate()
                if (e.key === 'Escape') setReplyTo(null)
              }}
              maxLength={1000}
              placeholder={replyTo ? `Reply to @${replyTo.userId?.username ?? 'user'}…` : 'Add a comment…'}
              className="flex-1 bg-white/10 rounded-full px-4 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:bg-white/15"
            />
            <button
              onClick={() => text.trim() && post.mutate()}
              disabled={!text.trim() || post.isPending}
              aria-label="Post comment"
              className="w-9 h-9 rounded-full bg-brand-green flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
            >
              {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : (
        <p className="border-t border-white/10 px-4 py-3 text-center text-white/50 text-sm">Sign in to join the conversation.</p>
      )}
    </motion.div>
  )
}
