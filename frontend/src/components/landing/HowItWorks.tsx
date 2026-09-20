import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ArrowDown, BadgeCheck, MessagesSquare, PlaySquare, WalletCards } from 'lucide-react'

const steps = [
  { icon: PlaySquare, step: '01', key: 'one' },
  { icon: MessagesSquare, step: '02', key: 'two' },
  { icon: WalletCards, step: '03', key: 'three' },
] as const

export const HowItWorks = () => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  return <section id="how-it-works" className="relative overflow-hidden bg-[#07110c] px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
    <div className="pointer-events-none absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-green-500/[.07] blur-[100px]" />
    <div className="relative mx-auto max-w-[1440px]">
      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid gap-8 border-b border-white/10 pb-12 lg:grid-cols-2 lg:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.22em] text-[#d9ff43]">{t('landing.how.eyebrow')}</p><h2 className="mt-5 text-4xl font-semibold leading-[.94] tracking-[-.05em] sm:text-5xl lg:text-6xl" style={{ fontFamily: 'var(--font-display)' }}>{t('landing.how.titleA')}<br />{t('landing.how.titleB')}</h2></div><p className="max-w-lg text-lg leading-8 text-white/65 lg:justify-self-end">{t('landing.how.body')}</p></motion.div>
      <div className="mt-8 grid lg:grid-cols-3">{steps.map(({ icon: Icon, step, key }, i) => <motion.article key={step} initial={{ opacity: 0, y: reduceMotion ? 0 : 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .3 }} transition={{ duration: .58, delay: i * .1 }} className="group relative border-b border-white/10 py-9 lg:border-b-0 lg:border-r lg:px-9 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"><div className="flex items-center justify-between"><span className="font-mono text-sm text-[#d9ff43]">/{step}</span><div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[.04] transition-colors group-hover:border-[#d9ff43]/30 group-hover:bg-[#d9ff43] group-hover:text-[#102014]"><Icon className="h-6 w-6" /></div></div><h3 className="mt-12 text-2xl font-semibold tracking-tight sm:text-3xl">{t(`landing.how.${key}Title`)}</h3><p className="mt-4 max-w-sm leading-7 text-white/65">{t(`landing.how.${key}Desc`)}</p><p className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-white/50"><BadgeCheck className="h-4 w-4 text-[#d9ff43]" />{t(`landing.how.${key}Detail`)}</p>{i < 2 && <ArrowDown className="absolute -bottom-3 right-3 z-10 h-6 w-6 rounded-full bg-[#07110c] p-1 text-white/40 lg:hidden" />}</motion.article>)}</div>
    </div>
  </section>
}
