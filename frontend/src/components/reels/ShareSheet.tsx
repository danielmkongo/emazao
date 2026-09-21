import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { X, Search, Check, Link2, Share, Send, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { ReelThumb } from '@/components/reels/ReelThumb'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

interface Conversation { _id: string; participants: User[] }

function useDebounce<T>(value: T, ms: number): T {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t) }, [value, ms])
  return d
}

/**
 * Instagram-style "Send to": people you already talk to first, then search;
 * pick several; add a note; send. Each person receives the reel in their own
 * direct chat with you. Copying the link and the phone's native share sheet
 * stay available underneath for sending it off-platform.
 */
export function ShareSheet({
  reelId, thumbnailUrl, videoUrl, onClose, onShared,
}: {
  reelId: string
  /** Shown beside the message box, so it is clear what is being sent. */
  thumbnailUrl?: string
  videoUrl?: string
  onClose: () => void
  onShared: (count: number) => void
}) {
  const { user, isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Map<string, User>>(new Map())
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const debounced = useDebounce(q, 250)
  const url = `${window.location.origin}/reels/${reelId}`

  // Recent chats, most recent first — who you are most likely sending this to.
  const { data: recent = [], isLoading: loadingRecent } = useQuery({
    queryKey: ['conversations', user?._id],
    queryFn: async () => (await api.get<ApiResponse<Conversation[]>>('/messages')).data.data ?? [],
    enabled: isAuthenticated,
    select: (convs: Conversation[]) => convs
      .map(c => c.participants.find(p => p && String(p._id) !== String(user?._id)))
      .filter((p): p is User => Boolean(p)),
  })

  const { data: results = [], isFetching: searching } = useQuery({
    queryKey: ['share-search', debounced],
    queryFn: async () => {
      const params = new URLSearchParams({ role: 'ALL', limit: '20', q: debounced })
      return ((await api.get<ApiResponse<User[]>>(`/users?${params}`)).data.data ?? [])
        .filter(u => String(u._id) !== String(user?._id))
    },
    enabled: isAuthenticated && debounced.trim().length > 0,
  })

  const people = useMemo(() => {
    const list = debounced.trim() ? results : recent
    const seen = new Set<string>()
    return list.filter(p => (seen.has(p._id) ? false : (seen.add(p._id), true)))
  }, [debounced, results, recent])

  const toggle = (p: User) => setPicked(m => {
    const next = new Map(m)
    if (next.has(p._id)) next.delete(p._id)
    else next.set(p._id, p)
    return next
  })

  const send = useMutation({
    mutationFn: async () => (await api.post<ApiResponse<{ sent: number }>>('/messages/share-reel', {
      reelId, recipientIds: [...picked.keys()], note: note.trim() || undefined,
    })).data.data,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      onShared(data?.sent ?? picked.size)
      onClose()
    },
  })

  const copy = async () => {
    try { await navigator.clipboard.writeText(url) } catch {
      const el = document.createElement('textarea')
      el.value = url; el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const nativeShare = async () => {
    try { await navigator.share({ url }) } catch { /* cancelled */ }
  }

  // Portalled to the page so it is never trapped under a transformed parent
  // (a reel card), where "fixed" stops meaning the whole screen.
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      onClick={onClose}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-[var(--c-card)] rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h3 className="font-semibold text-[var(--c-text)]">Share</h3>
          <button onClick={onClose} aria-label="Close" className="text-[var(--c-text-3)] hover:text-[var(--c-text)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 focus-within:border-brand-green">
            <Search className="h-4 w-4 text-[var(--c-text-4)] shrink-0" />
            <input
              id="share-search" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search people" autoComplete="off"
              className="flex-1 bg-transparent py-2.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none"
            />
            {searching && <Loader2 className="h-4 w-4 animate-spin text-[var(--c-text-4)]" />}
          </div>
        </div>

        <div className="overflow-y-auto px-3 flex-1 min-h-[180px]">
          {!q.trim() && (
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--c-text-4)]">Recent</p>
          )}
          {loadingRecent && !q.trim() ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-text-4)]" /></div>
          ) : !people.length ? (
            <p className="text-center text-sm text-[var(--c-text-3)] py-8 px-4">
              {q.trim() ? 'No one found by that name.' : 'Search for someone to send this to.'}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1 pb-2">
              {people.map(p => {
                const on = picked.has(p._id)
                return (
                  <button key={p._id} onClick={() => toggle(p)} aria-pressed={on}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[var(--c-raised)] transition-colors">
                    <span className="relative">
                      <Avatar src={p.avatar} name={p.name} size="lg" />
                      {on && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand-green text-white flex items-center justify-center ring-2 ring-[var(--c-card)]">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className={`text-[11px] text-center leading-tight line-clamp-2 ${on ? 'text-[var(--c-text)] font-medium' : 'text-[var(--c-text-2)]'}`}>
                      {p.name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {picked.size > 0 ? (
          <div className="border-t border-[var(--c-border)] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                <ReelThumb thumbnailUrl={thumbnailUrl} videoUrl={videoUrl} className="h-full w-full" />
              </div>
              <input
                id="share-note" value={note} onChange={e => setNote(e.target.value)} maxLength={2000}
                placeholder="Write a message…"
                className="min-w-0 flex-1 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-brand-green"
              />
            </div>
            {send.isError && (
              <p className="text-red-500 text-xs">{(send.error as any)?.response?.data?.message ?? 'Could not send.'}</p>
            )}
            <button
              onClick={() => send.mutate()} disabled={send.isPending}
              className="w-full flex items-center justify-center gap-2 bg-brand-green text-white rounded-xl py-3 font-semibold text-sm hover:bg-brand-emerald disabled:opacity-60 transition-colors"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {picked.size === 1 ? `Send to ${[...picked.values()][0]!.name.split(' ')[0]}` : `Send separately to ${picked.size} people`}
            </button>
          </div>
        ) : (
          <div className="border-t border-[var(--c-border)] px-5 py-4 flex gap-6">
            <button onClick={copy} className="flex flex-col items-center gap-1.5 text-[var(--c-text-2)] hover:text-[var(--c-text)]">
              <span className="w-12 h-12 rounded-full bg-[var(--c-raised)] flex items-center justify-center">
                {copied ? <Check className="h-5 w-5 text-brand-green" /> : <Link2 className="h-5 w-5" />}
              </span>
              <span className="text-[11px]">{copied ? 'Copied' : 'Copy link'}</span>
            </button>
            {'share' in navigator && (
              <button onClick={nativeShare} className="flex flex-col items-center gap-1.5 text-[var(--c-text-2)] hover:text-[var(--c-text)]">
                <span className="w-12 h-12 rounded-full bg-[var(--c-raised)] flex items-center justify-center">
                  <Share className="h-5 w-5" />
                </span>
                <span className="text-[11px]">More</span>
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
