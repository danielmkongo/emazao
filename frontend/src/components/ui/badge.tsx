import { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-brand-green/15 text-brand-green text-xs px-2.5 py-0.5',
        gold:    'bg-gold/15 text-gold text-xs px-2.5 py-0.5',
        outline: 'border border-[var(--c-border)] text-[var(--c-text-2)] text-xs px-2.5 py-0.5',
        glass:   'glass text-[var(--c-text)] text-xs px-2.5 py-0.5',
        urgent:  'bg-red-500/15 text-red-500 text-xs px-2.5 py-0.5',
        organic: 'bg-emerald-500/15 text-emerald-600 text-xs px-2.5 py-0.5',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant, className }))} {...props} />
)

export { Badge, badgeVariants }
