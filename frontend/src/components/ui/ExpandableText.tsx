import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/**
 * Text clamped to a few lines with Instagram's "… more". The toggle only
 * appears when something is actually hidden, and tapping anywhere on the text
 * opens it; "less" folds it back.
 */
export function ExpandableText({ children, lines = 2, className, moreClassName }: {
  children: React.ReactNode
  lines?: 2 | 3 | 4
  className?: string
  moreClassName?: string
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [clipped, setClipped] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || open) return
    const check = () => setClipped(el.scrollHeight - el.clientHeight > 1)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [children, open])

  const clamp = { 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4' }[lines]

  return (
    <div>
      <p
        ref={ref}
        onClick={e => { if (clipped || open) { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) } }}
        className={cn(className, !open && clamp, (clipped || open) && 'cursor-pointer', 'whitespace-pre-line break-words')}
      >
        {children}
      </p>
      {!open && clipped && (
        <button type="button" onClick={e => { e.stopPropagation(); setOpen(true) }} className={cn('text-[14px] font-medium', moreClassName)}>
          {t('common.more').toLowerCase()}
        </button>
      )}
      {open && (
        <button type="button" onClick={e => { e.stopPropagation(); setOpen(false) }} className={cn('text-[14px] font-medium', moreClassName)}>
          {t('common.less')}
        </button>
      )}
    </div>
  )
}
