import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

/**
 * Language toggle. Three presentations from one source of truth:
 *  - "inline"  — segmented control for Settings
 *  - "compact" — single row for the sidebar footer
 *  - "pill"    — EN/SW on the landing page's dark nav bar, where a visitor
 *                who reads no English has to be able to find it before they
 *                have an account to store the preference against
 */
export function LanguageSwitcher({ variant = 'inline' }: { variant?: 'inline' | 'compact' | 'pill' }) {
  const { i18n, t } = useTranslation()
  const { isAuthenticated } = useAuthStore()
  const current = (i18n.resolvedLanguage ?? 'en') as LanguageCode

  const change = async (code: LanguageCode) => {
    if (code === current) return
    await i18n.changeLanguage(code) // persisted to localStorage by the detector
    // Mirror onto the account so the choice follows the user to another device.
    // Best-effort: the local switch has already applied, and a signed-out visitor
    // has nowhere to save it.
    if (isAuthenticated) {
      api.put('/users/me', { language: code }).catch(() => {})
    }
  }

  if (variant === 'pill') {
    return (
      <div className="flex items-center rounded-full border border-white/15 bg-white/[0.06] p-0.5" role="group" aria-label="Language">
        {SUPPORTED_LANGUAGES.map(({ code }) => (
          <button
            key={code}
            onClick={() => change(code)}
            aria-pressed={current === code}
            title={SUPPORTED_LANGUAGES.find(l => l.code === code)!.nativeLabel}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors sm:text-xs',
              current === code ? 'bg-[#d9ff43] text-[#0b160e]' : 'text-white/55 hover:text-white',
            )}
          >
            {code}
          </button>
        ))}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1 rounded-md p-1 bg-[var(--c-raised)]/60">
        <Languages className="h-4 w-4 text-[var(--c-text-4)] ml-1.5 flex-shrink-0" />
        {SUPPORTED_LANGUAGES.map(({ code, nativeLabel }) => (
          <button
            key={code}
            onClick={() => change(code)}
            aria-pressed={current === code}
            className={cn(
              'flex-1 h-7 rounded text-xs font-medium transition-colors',
              current === code
                ? 'bg-[var(--c-card)] text-[var(--c-text)] shadow-sm'
                : 'text-[var(--c-text-3)] hover:text-[var(--c-text)]',
            )}
          >
            {nativeLabel}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div>
      <label className="text-sm font-medium text-[var(--c-text-2)] mb-2 block">
        {t('common.language')}
      </label>
      <div className="flex gap-2">
        {SUPPORTED_LANGUAGES.map(({ code, nativeLabel, label }) => (
          <button
            key={code}
            onClick={() => change(code)}
            aria-pressed={current === code}
            className={cn(
              'flex-1 flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border text-left transition-all',
              current === code
                ? 'border-brand-green bg-brand-green/8 ring-2 ring-brand-green/15'
                : 'border-[var(--c-border)] bg-[var(--c-input)] hover:border-brand-green/40',
            )}
          >
            <span className="text-sm font-medium text-[var(--c-text)]">{nativeLabel}</span>
            {label !== nativeLabel && (
              <span className="text-xs text-[var(--c-text-3)]">{label}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
