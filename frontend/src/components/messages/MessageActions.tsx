import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Reply, Pencil, Undo2, Copy, MoreHorizontal } from 'lucide-react'

export interface MessageAction {
  key: 'reply' | 'edit' | 'recall' | 'copy'
  label: string
  run: () => void
  danger?: boolean
}

const ICONS = { reply: Reply, edit: Pencil, recall: Undo2, copy: Copy }

/**
 * The same actions, reached the way each device expects.
 *
 * A phone has no hover, so a button floating beside every bubble would be
 * permanent clutter — there, a long press opens a sheet. A desktop has no
 * long press worth the name, so the trigger appears on hover next to the
 * bubble. One list of actions feeds both, so they cannot drift apart.
 */
export function useMessageActions() {
  const [sheet, setSheet] = useState<MessageAction[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moved = useRef(false)

  const cancel = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }

  /** Spread onto a bubble to give it a long press, on touch only. */
  const longPress = (actions: MessageAction[]) => ({
    onTouchStart: () => {
      moved.current = false
      cancel()
      timer.current = setTimeout(() => {
        if (moved.current) return
        try { navigator.vibrate?.(12) } catch { /* not on iOS */ }
        setSheet(actions)
      }, 450)
    },
    // Scrolling the thread must not count as a press.
    onTouchMove: () => { moved.current = true; cancel() },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    // Chrome on Android raises its own text-selection menu otherwise.
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault() },
  })

  useEffect(() => cancel, [])

  const sheetNode = (
    <AnimatePresence>
      {sheet && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-black/45" onClick={() => setSheet(null)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="relative w-full rounded-t-3xl bg-[var(--c-card)] pb-[max(12px,env(safe-area-inset-bottom))] pt-2"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            <div className="w-10 h-1 rounded-full bg-[var(--c-border)] mx-auto mb-2" />
            {sheet.map(a => {
              const Icon = ICONS[a.key]
              return (
                <button key={a.key}
                  onClick={() => { setSheet(null); a.run() }}
                  className={`flex w-full items-center gap-3.5 px-6 py-3.5 text-[15px] font-medium ${
                    a.danger ? 'text-red-500' : 'text-[var(--c-text)]'}`}
                >
                  <Icon className="h-[18px] w-[18px]" /> {a.label}
                </button>
              )
            })}
          </motion.div>
        </div>,
        document.body,
      )}
    </AnimatePresence>
  )

  return { longPress, sheetNode }
}

/**
 * The hover trigger and its menu, desktop only. Hidden from touch devices
 * entirely rather than merely dimmed, since there it would never be reachable.
 * The menu itself is portalled and fixed: inside the thread it was clipped by
 * the scroll container and disappeared behind the sticky header.
 */
export function MessageMenu({ actions, isMe }: { actions: MessageAction[]; isMe: boolean }) {
  const btn = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ top: number; left: number; above: boolean } | null>(null)

  useEffect(() => {
    if (!at) return
    const close = () => setAt(null)
    // Any click elsewhere, and any scroll of the thread, and the menu is done —
    // it is positioned against a bubble that is about to move.
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [at])

  if (!actions.length) return null

  const MENU_H = actions.length * 34 + 8
  const open = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    // The thread scrolls, so an absolutely-positioned menu was clipped by it
    // and slid under the sticky header. Fixed coordinates in a portal escape
    // both; it flips below the button when there is no room above.
    const above = r.top > MENU_H + 12
    setAt({
      top: above ? r.top - MENU_H - 4 : r.bottom + 4,
      left: Math.min(Math.max(8, isMe ? r.right - 176 : r.left), window.innerWidth - 184),
      above,
    })
  }

  return (
    <div className="hidden self-center [@media(hover:hover)_and_(pointer:fine)]:block">
      <button
        ref={btn}
        onClick={e => { e.stopPropagation(); at ? setAt(null) : open() }}
        aria-label="Message actions"
        aria-expanded={!!at}
        className={`h-7 w-7 rounded-full flex items-center justify-center text-[var(--c-text-4)] transition-opacity hover:bg-[var(--c-raised)] hover:text-[var(--c-text)] ${
          at ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {at && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{ top: at.top, left: at.left }}
          className="fixed z-[80] min-w-[176px] rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] py-1 shadow-xl"
        >
          {actions.map(a => {
            const Icon = ICONS[a.key]
            return (
              <button key={a.key}
                onClick={() => { setAt(null); a.run() }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-[13.5px] hover:bg-[var(--c-input)] ${
                  a.danger ? 'text-red-500' : 'text-[var(--c-text)]'}`}
              >
                <Icon className="h-4 w-4" /> {a.label}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
