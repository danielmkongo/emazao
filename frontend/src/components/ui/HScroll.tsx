import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HScrollProps {
  children: React.ReactNode
  /** Classes for the scrolling strip itself (gaps, padding, snap behaviour). */
  className?: string
  /** Classes for the positioning wrapper the arrows are placed against. */
  outerClassName?: string
  /**
   * How far one arrow press travels. "page" moves a full width — right for a
   * gallery where each slide fills the frame; "partial" moves most of one,
   * which keeps a chip or card half in view so the row still reads as a row.
   */
  step?: 'page' | 'partial'
  /** Sits the arrows inside the strip, over the content, rather than at its edge. */
  inset?: boolean
  label?: string
  onScroll?: React.UIEventHandler<HTMLDivElement>
  /** For callers that drive the strip themselves (thumbnail strips, dots). */
  innerRef?: React.RefObject<HTMLDivElement>
}

/**
 * A horizontal strip that a mouse can actually get through.
 *
 * Touch has swipe and every one of these rows was built for it; a desktop
 * visitor had a trackpad gesture most people never discover and, with the
 * scrollbar hidden, no visible way at all to reach categories or the second
 * photo of a post. The arrows appear on hover, only on pointers that have a
 * hover state, and only on the side there is something left to scroll to —
 * so nothing changes on a phone.
 */
export function HScroll({
  children, className, outerClassName, step = 'partial', inset, label, onScroll, innerRef,
}: HScrollProps) {
  const own = useRef<HTMLDivElement>(null)
  const ref = innerRef ?? own
  const [at, setAt] = useState({ start: true, end: true })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setAt({ start: el.scrollLeft <= 4, end: el.scrollLeft >= max - 4 })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    // Content arrives asynchronously (categories, images), and the window can
    // be resized past the point where there is anything left to scroll.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [measure, children])

  const nudge = (dir: 1 | -1) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * (step === 'page' ? 1 : 0.8), behavior: 'smooth' })
  }

  const arrow = (dir: 1 | -1, hidden: boolean) => (
    <button
      type="button"
      onClick={nudge(dir)}
      tabIndex={-1}
      aria-label={dir === 1 ? 'Scroll right' : 'Scroll left'}
      className={cn(
        'absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full',
        'bg-[var(--c-card)]/90 text-[var(--c-text)] shadow-lg ring-1 ring-[var(--c-border)] backdrop-blur',
        'transition-opacity duration-200 hover:bg-[var(--c-card)]',
        // Hover-capable pointers only: on a touch screen these would sit on top
        // of the content permanently for no reason.
        '[@media(hover:hover)_and_(pointer:fine)]:flex',
        'opacity-0 group-hover/hscroll:opacity-100 focus-visible:opacity-100',
        hidden && 'pointer-events-none !opacity-0',
        dir === 1 ? (inset ? 'right-2' : '-right-3') : (inset ? 'left-2' : '-left-3'),
      )}
    >
      {dir === 1 ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
    </button>
  )

  return (
    <div className={cn('group/hscroll relative', outerClassName)}>
      {arrow(-1, at.start)}
      <div
        ref={ref}
        role={label ? 'group' : undefined}
        aria-label={label}
        onScroll={(e) => { measure(); onScroll?.(e) }}
        className={cn('overflow-x-auto no-scrollbar', className)}
      >
        {children}
      </div>
      {arrow(1, at.end)}
    </div>
  )
}
