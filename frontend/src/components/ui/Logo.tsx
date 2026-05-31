import { useState } from 'react'
import { Sprout } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps { className?: string; iconOnly?: boolean }

export const Logo = ({ className, iconOnly = false }: LogoProps) => {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-lime to-brand-green flex items-center justify-center shadow-lg shadow-brand-green/30 flex-shrink-0">
          <Sprout className="h-5 w-5 text-white" />
        </div>
        {!iconOnly && (
          <span className="text-xl font-bold gradient-text" style={{ fontFamily: 'var(--font-display)' }}>
            eMazao
          </span>
        )}
      </div>
    )
  }

  return (
    <img
      src="/emazao.png"
      alt="eMazao"
      className={cn('object-contain', className)}
      onError={() => setFailed(true)}
    />
  )
}
