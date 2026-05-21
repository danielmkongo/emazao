import { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-brand-green/15 text-brand-lime text-xs px-2.5 py-0.5',
        gold: 'bg-gold/15 text-gold text-xs px-2.5 py-0.5',
        outline: 'border border-white/20 text-white/70 text-xs px-2.5 py-0.5',
        glass: 'glass text-white text-xs px-2.5 py-0.5',
        urgent: 'bg-red-500/15 text-red-400 text-xs px-2.5 py-0.5',
        organic: 'bg-emerald-500/15 text-emerald-400 text-xs px-2.5 py-0.5',
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
