import { forwardRef, InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, type = 'text', ...props }, ref) => (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-sm font-medium text-[var(--c-text-2)]">{label}</label>
      )}
      {/* `group` + peer-focus lets the icons react to focus, so the field feels
          responsive rather than decorated with static grey glyphs. */}
      <div className="relative group">
        {leftIcon && (
          <div
            className={cn(
              'absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none',
              'text-[var(--c-text-4)] transition-colors duration-200',
              'group-focus-within:text-brand-green',
              error && 'text-red-500/70',
            )}
          >
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full h-12 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 text-[var(--c-text)] text-sm',
            'placeholder:text-[var(--c-text-4)]',
            // A visible ring plus a subtle lift reads as deliberate focus rather
            // than the browser default outline.
            'focus:outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/15',
            'hover:border-[var(--c-text-4)]/40',
            'transition-[border-color,box-shadow,background-color] duration-200',
            leftIcon && 'pl-11',
            rightIcon && 'pr-11',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/15 hover:border-red-500',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--c-text-4)] hover:text-[var(--c-text-2)] transition-colors duration-200">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

export { Input }
