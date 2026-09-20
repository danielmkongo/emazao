import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BadgeCheck, Compass, MapPin, Star } from 'lucide-react'

const ease = [0.16, 1, 0.3, 1] as const

export const HeroSection = () => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: .72, delay, ease },
  })

  return (
    <section className="relative min-h-screen overflow-hidden pt-[76px]">
      <div className="absolute inset-0">
        <img src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=2200&q=88" alt={t('landing.hero.imageAlt')} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,15,9,.97)_0%,rgba(5,15,9,.84)_45%,rgba(5,15,9,.22)_78%,rgba(5,15,9,.48)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#07110c_0%,transparent_42%)]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-4.75rem)] max-w-[1440px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-12">
        <div className="max-w-3xl">
          {/* A quiet label, not a second headline: the lime is spent on "Buy."
              and the main button, so this recedes into the photograph. */}
          <motion.p {...reveal()} className="mb-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[.18em] text-white/45 sm:text-[11.5px]">
            <span className="hidden h-px w-7 shrink-0 bg-white/25 sm:block" />
            {t('landing.hero.eyebrow')}
          </motion.p>
          <motion.h1 {...reveal(.06)} className="text-[clamp(3.6rem,7.2vw,7.5rem)] font-semibold leading-[.89] tracking-[-.065em]" style={{ fontFamily: 'var(--font-display)' }}>
            {t('landing.hero.grow')} <span className="text-[#f59e0b]">{t('landing.hero.sell')}</span> <span className="text-[#d9ff43]">{t('landing.hero.buy')}</span>
          </motion.h1>
          <motion.p {...reveal(.14)} className="mt-7 max-w-xl text-lg leading-8 text-white/65 sm:text-xl">
            {t('landing.hero.sub')}
          </motion.p>
          <motion.div {...reveal(.22)} className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/marketplace" className="group flex items-center gap-3 rounded-full bg-[#d9ff43] px-8 py-4 text-lg font-bold text-[#0b160e] transition-transform hover:scale-[1.03]"><Compass className="h-5 w-5" /> {t('landing.hero.explore')} <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></Link>
            <Link to="/register" className="group flex items-center gap-3 rounded-full border border-white/25 bg-white/10 px-7 py-4 font-semibold backdrop-blur-md transition-colors hover:bg-white/15">{t('landing.hero.createAccount')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </motion.div>
          <motion.p {...reveal(.28)} className="mt-4 text-sm text-white/45">{t('landing.hero.noAccountNeeded')}</motion.p>
          <motion.div {...reveal(.32)} className="mt-11 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-sm text-white/65">
            <span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-[#d9ff43]" /> {t('landing.hero.verifiedSellers')}</span><span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-[#d9ff43]" /> {t('landing.hero.deliveryGuarantee')}</span><span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-[#d9ff43]" /> {t('landing.hero.instantCashout')}</span>
          </motion.div>
          <motion.div {...reveal(.4)} className="mt-9 max-w-md lg:hidden">
            <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-[#102018]/90 p-3 shadow-2xl backdrop-blur-xl">
              <img src="https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=500&q=85" alt="Fresh Hass avocados ready for market" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d9ff43]"><BadgeCheck className="h-3.5 w-3.5" /> {t('landing.hero.freshToday')}</div><p className="mt-1 truncate text-lg font-bold">Hass Avocados</p><p className="mt-1 text-sm text-white/65">TZS 2,400 / kg · Mbeya</p><p className="mt-2 text-xs text-white/45">{t('landing.hero.availableFrom', { farm: "Mathew's Farm" })}</p></div>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, x: reduceMotion ? 0 : 36 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .85, delay: .25, ease }} className="relative hidden justify-self-end lg:block">
          <motion.article animate={reduceMotion ? {} : { y: [0, -7, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} className="w-[min(430px,34vw)] overflow-hidden rounded-[2rem] border border-white/15 bg-[#102018]/90 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="relative h-[390px] overflow-hidden rounded-[1.45rem]">
              <img src="https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=1000&q=85" alt="Fresh avocados ready for market" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-6 pt-24"><span className="rounded-full bg-[#d9ff43] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#102014]">{t('landing.hero.freshToday')}</span><h2 className="mt-3 text-3xl font-bold">Hass Avocados</h2></div>
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/20 bg-[#07110c]/80 py-2 pl-2 pr-3 backdrop-blur-xl"><img src="/mathew.png" alt="Mathew's Farm" className="h-8 w-8 rounded-full object-cover object-top" /><div><p className="text-xs font-bold">Mathew's Farm</p><p className="flex items-center gap-1 text-[9px] text-white/60"><BadgeCheck className="h-3 w-3 text-[#d9ff43]" /> {t('landing.hero.verifiedGrower')}</p></div></div>
            </div>
            <div className="flex items-center justify-between px-3 pb-2 pt-4"><div><p className="text-xs text-white/45">{t('landing.hero.from')}</p><p className="text-lg font-bold">TZS 2,400 <span className="text-xs font-normal text-white/45">/ kg</span></p></div><div className="text-right"><p className="flex items-center gap-1 text-xs text-white/55"><MapPin className="h-3 w-3" /> Mbeya, Tanzania</p><p className="mt-1 flex items-center justify-end gap-1 text-sm font-semibold"><Star className="h-3 w-3 fill-[#d9ff43] text-[#d9ff43]" /> 4.9</p></div></div>
          </motion.article>
        </motion.div>
      </div>
      <div className="relative border-y border-white/[0.08] bg-white/[0.035] py-4 backdrop-blur-sm"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-5 overflow-hidden px-5 text-[11px] font-bold uppercase tracking-[.16em] text-white/55 sm:px-8 lg:px-12 lg:tracking-[.2em]"><span className="whitespace-nowrap">{t('landing.hero.ticker.one')}</span><span className="text-[#d9ff43]">•</span><span className="whitespace-nowrap">{t('landing.hero.ticker.two')}</span><span className="hidden text-[#d9ff43] sm:inline">•</span><span className="hidden whitespace-nowrap sm:inline">{t('landing.hero.ticker.three')}</span><span className="hidden text-[#d9ff43] md:inline">•</span><span className="hidden whitespace-nowrap md:inline">{t('landing.hero.ticker.four')}</span></div></div>
    </section>
  )
}
