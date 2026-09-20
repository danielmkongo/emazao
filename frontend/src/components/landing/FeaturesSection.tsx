import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, BadgeCheck, Radio, ScanSearch, ShieldCheck, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const features = [
  { icon: Store, n: '01', key: 'one' },
  { icon: Radio, n: '02', key: 'two' },
  { icon: ScanSearch, n: '03', key: 'three' },
  { icon: ShieldCheck, n: '04', key: 'four' },
] as const

export const FeaturesSection = () => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  return <section className="bg-[#f2f0e6] px-5 py-24 text-[#102014] sm:px-8 lg:px-12 lg:py-28"><div className="mx-auto max-w-[1440px]">
    <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lg:sticky lg:top-32 lg:self-start"><p className="text-xs font-extrabold uppercase tracking-[.22em] text-green-700">{t('landing.features.eyebrow')}</p><h2 className="mt-5 text-5xl font-semibold leading-[.95] tracking-[-.05em] sm:text-6xl lg:text-7xl" style={{ fontFamily: 'var(--font-display)' }}>{t('landing.features.title')}</h2><p className="mt-7 max-w-md text-lg leading-8 text-black/60">{t('landing.features.body')}</p><Link to="/register?intent=sell" className="mt-8 inline-flex items-center gap-2 border-b border-black/30 pb-1 font-bold hover:border-black">{t('landing.features.cta')} <ArrowUpRight className="h-4 w-4" /></Link></motion.div>
      <div className="grid gap-px overflow-hidden rounded-[2rem] border border-black/10 bg-black/10 sm:grid-cols-2">{features.map(({ icon: Icon, n, key }, i) => <motion.article key={key} initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ delay: i * .07, duration: .55 }} className="group min-h-[270px] bg-[#fbfaf5] p-7 transition-colors hover:bg-[#d9ff43] sm:p-9"><div className="flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#102014] text-white"><Icon className="h-5 w-5" /></div><span className="font-mono text-xs text-black/40">{n}</span></div><h3 className="mt-10 text-2xl font-bold tracking-tight">{t(`landing.features.${key}Title`)}</h3><p className="mt-4 leading-7 text-black/60 group-hover:text-black/70">{t(`landing.features.${key}Desc`)}</p></motion.article>)}</div>
    </div>
    <div className="mt-20 grid overflow-hidden rounded-[2rem] bg-[#102014] text-white lg:grid-cols-2"><div className="min-h-[420px] overflow-hidden"><img src="/farmers-market-ready-v2.png" alt={t('landing.features.bannerAlt')} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" /></div><div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16"><BadgeCheck className="h-10 w-10 text-[#d9ff43]" /><p className="mt-8 text-3xl font-medium leading-tight sm:text-4xl">{t('landing.features.bannerQuote')}</p><div className="mt-10 flex flex-col gap-6 border-t border-white/10 pt-7 sm:flex-row sm:gap-10"><div><strong className="text-2xl text-[#d9ff43] sm:text-3xl">{t('landing.features.alwaysOpen')}</strong><p className="mt-1 text-sm text-white/60">{t('landing.features.alwaysOpenSub')}</p></div><div><strong className="text-2xl text-[#d9ff43] sm:text-3xl">{t('landing.features.escrow')}</strong><p className="mt-1 text-sm text-white/60">{t('landing.features.escrowSub')}</p></div></div></div></div>
  </div></section>
}
