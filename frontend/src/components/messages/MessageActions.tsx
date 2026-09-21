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

/** How far a message has to travel before letting go counts as "reply". */
const SWIPE_TRIGGER = 56
/** A finger never holds perfectly still; movement under this is not a gesture. */
const JITTER = 10
const LONG_PRESS_MS = 420

const buzz = (ms: number) => { try { navigator.vibrate?.(ms) } catch { /* iOS has no vibration API */ } }

/**
 * The bottom sheet a long press opens on a phone. One list of actions feeds
 * this and the desktop hover menu, so the two cannot drift apart.
 */
export function useMessageSheet() {
  const [sheet, setSheet] = useState<MessageAction[] | null>(null)
  // The finger that opened the sheet is still on the glass when it appears;
  // lifting it produces a click, and that click landed on the backdrop and
  // shut the sheet the instant it opened. Taps in the first moment are ignored.
  const openedAt = useRef(0)
  const open = (actions: MessageAction[]) => { openedAt.current = Date.now(); setSheet(actions) }
  const dismiss = () => { if (Date.now() - openedAt.current > 450) setSheet(null) }

  const sheetNode = createPortal(
    <AnimatePresence>
      {sheet && (
        <div className="fixed inset-0 z-[70] flex items-end" role="dialog" aria-modal="true" key="sheet">
          <motion.div className="absolute inset-0 bg-black/45" onClick={dismiss}
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
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )

  return { openSheet: open, sheetNode }
}

/**
 * A message row that answers to a thumb the way WhatsApp's does.
 *
 * Swipe right to reply: the message follows the finger, a reply arrow fades in
 * behind it, a tick of vibration marks the point of no return, and letting go
 * past it quotes the message in the composer. Hold still to get everything
 * else (copy, edit, recall) in a sheet.
 *
 * The earlier long press cancelled on any touchmove at all, and a real finger
 * always moves a pixel or two, so on an actual phone it never fired. Both
 * gestures now ignore movement under JITTER, and the row declares
 * `touch-action: pan-y` so the browser keeps vertical scrolling while leaving
 * sideways movement to us.
 */
export function GestureRow({ children, onReply, onLongPress, className }: {
  children: React.ReactNode
  onReply?: () => void
  onLongPress?: () => void
  className?: string
}) {
  const inner = useRef<HTMLDivElement>(null)
  const icon = useRef<HTMLDivElement>(null)
  const g = useRef({ x: 0, y: 0, mode: 'idle' as 'idle' | 'swipe' | 'scroll', armed: false, timer: 0 as any, pressed: false })

  const paint = (dx: number) => {
    if (inner.current) inner.current.style.transform = dx ? `translateX(${dx}px)` : ''
    if (icon.current) {
      const p = Math.min(1, dx / SWIPE_TRIGGER)
      icon.current.style.opacity = String(p)
      icon.current.style.transform = `translateY(-50%) scale(${0.6 + p * 0.4})`
    }
  }

  const reset = () => {
    clearTimeout(g.current.timer)
    if (inner.current) inner.current.style.transition = 'transform 220ms cubic-bezier(.2,.8,.2,1)'
    if (icon.current) icon.current.style.transition = 'opacity 180ms, transform 180ms'
    paint(0)
    g.current.mode = 'idle'
    g.current.armed = false
  }

  return (
    <div
      className={`relative [touch-action:pan-y] ${className ?? ''}`}
      onTouchStart={e => {
        const t = e.touches[0]
        g.current = { x: t.clientX, y: t.clientY, mode: 'idle', armed: false, timer: 0, pressed: false }
        if (inner.current) inner.current.style.transition = 'none'
        if (icon.current) icon.current.style.transition = 'none'
        if (onLongPress) {
          g.current.timer = setTimeout(() => {
            if (g.current.mode !== 'idle') return
            buzz(12)
            g.current.mode = 'scroll' // the press is spent; nothing else fires
            g.current.pressed = true
            onLongPress()
          }, LONG_PRESS_MS)
        }
      }}
      onTouchMove={e => {
        const t = e.touches[0]
        const dx = t.clientX - g.current.x
        const dy = t.clientY - g.current.y
        if (Math.abs(dx) > JITTER || Math.abs(dy) > JITTER) clearTimeout(g.current.timer)
        if (g.current.mode === 'idle') {
          if (onReply && dx > JITTER && dx > Math.abs(dy) * 1.3) g.current.mode = 'swipe'
          else if (Math.abs(dx) > JITTER || Math.abs(dy) > JITTER) g.current.mode = 'scroll'
        }
        if (g.current.mode !== 'swipe') return
        // Follows the finger up to the trigger, then drags with resistance.
        const d = dx <= 0 ? 0 : dx < SWIPE_TRIGGER ? dx : Math.min(96, SWIPE_TRIGGER + (dx - SWIPE_TRIGGER) * 0.3)
        paint(d)
        if (d >= SWIPE_TRIGGER && !g.current.armed) { g.current.armed = true; buzz(10) }
        else if (d < SWIPE_TRIGGER && g.current.armed) g.current.armed = false
      }}
      onTouchEnd={e => {
        const fire = g.current.mode === 'swipe' && g.current.armed
        // After a long press, stop the browser turning the lift into a click.
        if (g.current.pressed) e.preventDefault()
        reset()
        if (fire) onReply?.()
      }}
      onTouchCancel={reset}
      // Android raises its own text-selection menu on a long press otherwise.
      onContextMenu={e => { if (onLongPress) e.preventDefault() }}
    >
      {onReply && (
        <div ref={icon} aria-hidden
          className="pointer-events-none absolute left-1 top-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--c-input)] text-[var(--c-text-2)]"
          style={{ opacity: 0, transform: 'translateY(-50%) scale(.6)' }}>
          <Reply className="h-4 w-4" />
        </div>
      )}
      <div ref={inner} className="[@media(hover:none)]:select-none [@media(hover:none)]:[-webkit-touch-callout:none]">
        {children}
      </div>
    </div>
  )
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
