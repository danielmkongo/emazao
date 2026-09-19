import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { CircleDashed, Clapperboard, PackagePlus, FileText, Radio, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useStoryUI } from '@/lib/stories'

/**
 * One "+" for everything you can make. Sellers and buyers make different
 * things, so the sheet only offers what applies to you instead of a menu of
 * options half of which lead to a permission error.
 */
export function CreateSheet() {
  const { t } = useTranslation()
  const open = useUIStore(s => s.createOpen)
  const setOpen = useUIStore(s => s.setCreateOpen)
  const openComposer = useStoryUI(s => s.openComposer)
  const user = useAuthStore(s => s.user)
  const isSeller = user?.role === 'FARMER'
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const go = (path: string) => { setOpen(false); navigate(path) }

  const options = [
    { icon: CircleDashed, label: t('create.story'), hint: t('create.storyHint'), tint: 'from-harvest to-orange-600',
      run: () => { setOpen(false); openComposer() } },
    ...(isSeller ? [
      { icon: Clapperboard, label: t('create.reel'), hint: t('create.reelHint'), tint: 'from-fuchsia-500 to-rose-500', run: () => go('/dashboard/reels') },
      { icon: PackagePlus, label: t('create.product'), hint: t('create.productHint'), tint: 'from-brand-lime to-brand-green', run: () => go('/dashboard/products/new') },
      { icon: Radio, label: t('create.live'), hint: t('create.liveHint'), tint: 'from-red-500 to-red-700', run: () => go('/live') },
    ] : [
      { icon: FileText, label: t('create.request'), hint: t('create.requestHint'), tint: 'from-sky-500 to-indigo-500', run: () => go('/requirements/post') },
    ]),
  ]

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label={t('create.title')}>
          <motion.div className="absolute inset-0 bg-[var(--c-overlay)] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)} />
          <motion.div
            className="relative w-full md:w-[420px] bg-[var(--c-card)] rounded-t-[28px] md:rounded-3xl border border-[var(--c-border)] shadow-2xl pb-[calc(env(safe-area-inset-bottom,0px)+12px)] md:pb-3"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 460, damping: 40 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) setOpen(false) }}
          >
            <div className="w-10 h-1 rounded-full bg-[var(--c-border)] mx-auto mt-2.5 md:hidden" />
            <p className="text-center font-bold text-[var(--c-text)] text-[17px] pt-3 pb-2" style={{ fontFamily: 'var(--font-display)' }}>{t('create.title')}</p>
            <div className="px-3 pb-1">
              {options.map(({ icon: Icon, label, hint, tint, run }, i) => (
                <motion.button
                  key={label}
                  onClick={run}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
                  className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-[var(--c-raised)] active:bg-[var(--c-raised)] text-left transition-colors"
                >
                  <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tint} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-[var(--c-text)]">{label}</span>
                    <span className="block text-[13px] text-[var(--c-text-3)]">{hint}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-[var(--c-text-4)]" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
