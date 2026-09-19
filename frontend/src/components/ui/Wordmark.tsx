import { cn } from '@/lib/utils'

/**
 * Compact brand lockup for bars: the logo's mark beside the name set in the
 * display face. The full logo, tagline included, stays for places with room
 * for it (sign-in, landing, desktop sidebar).
 */
export function Wordmark({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <img src="/emazao-mark.png?v=1" alt="" width={size * 0.9} height={size} style={{ height: size, width: 'auto' }} draggable={false} />
      <span
        className="font-extrabold tracking-[-0.02em] text-[var(--c-brand-ink)]"
        style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.8, lineHeight: 1 }}
      >
        eMazao
      </span>
    </span>
  )
}
