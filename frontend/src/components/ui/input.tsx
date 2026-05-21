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
      {label && <label className="text-sm font-medium text-white/70">{label}</label>}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">{leftIcon}</div>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full h-11 bg-brand-800 border border-white/10 rounded-xl px-4 text-white placeholder-white/30 text-sm',
            'focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/40',
            'transition-all duration-200',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/40',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">{rightIcon}</div>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

export { Input }
