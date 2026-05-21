import { ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  verified?: boolean
}

const sizes = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
  '2xl': 'h-24 w-24 text-2xl',
}

const badgeSizes = {
  xs: 'h-2 w-2 border',
  sm: 'h-3 w-3 border',
  md: 'h-4 w-4 border-2',
  lg: 'h-4 w-4 border-2',
  xl: 'h-5 w-5 border-2',
  '2xl': 'h-6 w-6 border-2',
}

const getInitials = (name?: string) =>
  name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

export const Avatar = ({ src, name, size = 'md', verified, className, alt, ...props }: AvatarProps) => (
  <div className={cn('relative inline-flex flex-shrink-0', className)}>
    {src ? (
      <img
        src={src}
        alt={alt || name || 'avatar'}
        className={cn('rounded-full object-cover ring-2 ring-white/10', sizes[size])}
        {...props}
      />
    ) : (
      <div
        className={cn(
          'rounded-full bg-gradient-to-br from-brand-green to-brand-emerald flex items-center justify-center font-semibold text-white',
          sizes[size]
        )}
      >
        {getInitials(name)}
      </div>
    )}
    {verified && (
      <span
        className={cn(
          'absolute -bottom-0.5 -right-0.5 rounded-full bg-brand-green border-brand-dark flex items-center justify-center verified-glow',
          badgeSizes[size]
        )}
      >
        <svg className="w-full h-full p-0.5" viewBox="0 0 16 16" fill="white">
          <path d="M6.5 11.5L3 8l1.5-1.5 2 2 5-5L13 5z" />
        </svg>
      </span>
    )}
  </div>
)
