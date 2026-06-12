import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share, Download } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const SNOOZE_KEY = 'emazao-install-snooze'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000 // ask again after a week

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

const snoozed = () => Date.now() - Number(localStorage.getItem(SNOOZE_KEY) || 0) < SNOOZE_MS

/**
 * Asks the user to install eMazao as an app. Chrome/Edge/Android get the native
 * install prompt via beforeinstallprompt; iOS Safari (which has no such event)
 * gets a one-line "Share → Add to Home Screen" hint instead.
 */
export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone() || snoozed()) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS never fires beforeinstallprompt — show the manual hint after a short delay
    let iosTimer: ReturnType<typeof setTimeout> | undefined
    if (isIos()) iosTimer = setTimeout(() => setShowIosHint(true), 4000)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      if (iosTimer) clearTimeout(iosTimer)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()))
    setDeferred(null)
    setShowIosHint(false)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'dismissed') localStorage.setItem(SNOOZE_KEY, String(Date.now()))
    setDeferred(null)
  }

  const visible = deferred !== null || showIosHint

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed left-3 right-3 bottom-[calc(96px_+_env(safe-area-inset-bottom))] lg:left-auto lg:right-6 lg:bottom-6 lg:w-96 z-50"
        >
          <div className="flex items-center gap-3.5 bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl shadow-2xl shadow-black/20 p-3.5">
            <div className="w-12 h-12 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <Logo iconOnly className="h-9 w-auto" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--c-text)]">Install eMazao</p>
              {deferred ? (
                <p className="text-xs text-[var(--c-text-3)] leading-snug">Full-screen, faster, works like a native app.</p>
              ) : (
                <p className="text-xs text-[var(--c-text-3)] leading-snug flex items-center gap-1 flex-wrap">
                  Tap <Share className="h-3.5 w-3.5 inline" /> then “Add to Home Screen”
                </p>
              )}
            </div>
            {deferred && (
              <button
                onClick={install}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-green text-white text-xs font-bold hover:bg-brand-emerald transition-colors flex-shrink-0"
              >
                <Download className="h-3.5 w-3.5" /> Install
              </button>
            )}
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--c-text-4)] hover:text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
