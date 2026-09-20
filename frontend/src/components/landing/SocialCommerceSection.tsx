import { motion, useReducedMotion } from 'framer-motion'
import { BadgeCheck, Heart, MessageCircle, Play, ShoppingBag, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export const SocialCommerceSection = () => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  return (
    <section id="social-commerce" className="border-b border-black/5 bg-[#eef4d8] px-5 py-24 text-[#102014] sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto grid max-w-[1440px] items-center gap-14 lg:grid-cols-[.82fr_1.18fr] lg:gap-20">
        <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }}>
          <p className="text-xs font-extrabold uppercase tracking-[.22em] text-green-800">{t('landing.social.eyebrow')}</p>
          <h2 className="mt-5 max-w-xl text-5xl font-semibold leading-[.94] tracking-[-.05em] sm:text-6xl" style={{ fontFamily: 'var(--font-display)' }}>
            {t('landing.social.title')}
          </h2>
          <p className="mt-7 max-w-lg text-lg leading-8 text-black/60">
            {t('landing.social.body')}
          </p>
          <div className="mt-9 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              ['01', t('landing.social.showTitle'), t('landing.social.showText')],
              ['02', t('landing.social.connectTitle'), t('landing.social.connectText')],
              ['03', t('landing.social.sellTitle'), t('landing.social.sellText')],
            ].map(([number, title, text]) => (
              <div key={number} className="border-t border-black/20 pt-4">
                <span className="font-mono text-xs text-black/40">/{number}</span>
                <p className="mt-3 font-bold">{title}</p>
                <p className="mt-1 text-sm leading-6 text-black/55">{text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: reduceMotion ? 0 : 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .7 }} className="relative mx-auto w-full max-w-[760px] rounded-[2rem] bg-[#07110c] p-3 text-white shadow-[0_35px_80px_rgba(16,32,20,.28)] sm:p-5">
          <div className="grid overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#102018] md:grid-cols-[1.05fr_.95fr]">
            <Link to="/reels" aria-label={t('landing.social.watchAria')} className="group relative block min-h-[430px] overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d9ff43]">
              <img src="/harvest-update-avocados.png" alt={t('landing.social.videoAlt')} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/15" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/25" />
              <div aria-hidden="true" className="absolute left-1/2 top-[43%] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/45 shadow-[0_12px_35px_rgba(0,0,0,.35)] backdrop-blur-md transition duration-300 group-hover:scale-110 group-hover:bg-black/60 group-focus-visible:scale-110 sm:h-[4.5rem] sm:w-[4.5rem]">
                <Play className="ml-1 h-7 w-7 fill-white text-white sm:h-8 sm:w-8" />
              </div>
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs backdrop-blur-md"><Play className="h-3.5 w-3.5 fill-[#d9ff43] text-[#d9ff43]" /> {t('landing.social.harvestUpdate')}</div>
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-sm font-bold"><img src="/mathew.jpg" alt="" className="h-7 w-7 rounded-full object-cover" /> Mathew&apos;s Farm <BadgeCheck className="h-4 w-4 text-[#d9ff43]" /></div>
                <p className="mt-3 max-w-md text-lg font-semibold">{t('landing.social.caption')}</p>
                <div className="mt-4 flex gap-4 text-xs text-white/65"><span className="flex items-center gap-1.5"><Heart className="h-4 w-4" /> 284</span><span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> 36</span><span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {t('landing.social.views', { count: '1.2k' })}</span></div>
              </div>
            </Link>
            <div className="flex flex-col justify-between p-5 sm:p-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[.18em] text-[#d9ff43]">{t('landing.social.attachedProduce')}</p>
                <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[.05]">
                  <img
                    src="/hass-avocado-harvest-listing.png"
                    alt={t('landing.social.listingAlt')}
                    className="h-36 w-full object-cover object-center"
                  />
                  <div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">Hass Avocados</p><p className="mt-1 text-xs text-white/45">{t('landing.social.readyNow')}</p></div><BadgeCheck className="h-5 w-5 text-[#d9ff43]" /></div><p className="mt-4 text-xl font-bold">TZS 2,400 <span className="text-xs font-normal text-white/45">/ kg</span></p></div>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-xl bg-[#d9ff43] px-4 py-3 text-sm font-bold text-[#102014]">{t('landing.social.viewProduce')}</div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-xs text-white/60"><span>{t('landing.social.buyersTalking')}</span><MessageCircle className="h-4 w-4 text-[#d9ff43]" /></div>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-5 -right-3 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-[#102014] shadow-xl sm:-right-5"><ShoppingBag className="h-4 w-4" /> {t('landing.social.flow')}</div>
        </motion.div>
      </div>
    </section>
  )
}
