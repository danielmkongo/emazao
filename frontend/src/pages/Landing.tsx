import { useState } from 'react'
import { AnimatePresence, motion, useScroll } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { SocialCommerceSection } from '@/components/landing/SocialCommerceSection'
import { BuyerBenefitsSection } from '@/components/landing/BuyerBenefitsSection'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { RequirementsShowcase } from '@/components/landing/RequirementsShowcase'
import { CTASection } from '@/components/landing/CTASection'
import { Footer } from '@/components/landing/Footer'
import { WhatsAppButton } from '@/components/landing/WhatsAppButton'

/**
 * Three of these are sections of this page, one is a route. The sections are
 * plain hash targets: React Router owns the URL but does nothing about the
 * hash, so `<Link to="/#how-it-works">` changed the address bar and left the
 * page exactly where it was — every one of them looked broken.
 */
const links = [
  { key: 'marketplace', to: '/marketplace' },
  { key: 'community', hash: 'social-commerce' },
  { key: 'howItWorks', hash: 'how-it-works' },
  { key: 'buyerRequests', hash: 'buyer-requests' },
] as const

export default function Landing() {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)
  const { scrollYProgress } = useScroll()

  const goTo = (hash: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuOpen(false)
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const navLink = (link: (typeof links)[number], className: string) =>
    'hash' in link ? (
      <a key={link.key} href={`#${link.hash}`} onClick={goTo(link.hash)} className={className}>
        {t(`landing.nav.${link.key}`)}
      </a>
    ) : (
      <Link key={link.key} to={link.to} onClick={() => setMenuOpen(false)} className={className}>
        {t(`landing.nav.${link.key}`)}
      </Link>
    )

  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-brand-dark text-white" data-theme="dark">
      <motion.div className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-brand-lime" style={{ scaleX: scrollYProgress }} />
      <motion.nav animate={{ opacity: footerVisible ? 0 : 1, y: footerVisible ? -24 : 0, pointerEvents: footerVisible ? 'none' : 'auto' }} transition={{ duration: .3, ease: [0.16, 1, 0.3, 1] }} className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 sm:gap-3">
          <Link
            to="/"
            aria-label={t('landing.nav.home')}
            className="flex h-16 shrink-0 items-center px-1"
            // Already on "/", so the Link itself is a no-op — without this the
            // logo did nothing when clicked partway down the page.
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          >
            <Logo className="h-[58px] w-auto drop-shadow-[0_5px_16px_rgba(0,0,0,.55)] sm:h-[68px]" />
          </Link>
          <div className="flex h-13 min-w-0 flex-1 items-center rounded-full border border-white/[0.09] bg-[#07110c]/76 px-1.5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:h-14 sm:px-2">
            <div className="hidden items-center gap-8 pl-5 md:flex lg:gap-10">{links.map((link) => navLink(link, 'cursor-pointer text-sm font-medium text-white/60 transition-colors hover:text-white'))}</div>
            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1"><LanguageSwitcher variant="pill" /><Link to="/login" className="px-2 py-2 text-[11px] font-semibold text-white/70 hover:text-white sm:px-3 sm:text-sm">{t('landing.nav.signIn')}</Link><Link to="/register" className="group flex items-center gap-1.5 rounded-full bg-[#d9ff43] px-3 py-2 text-[11px] font-bold text-[#0b160e] transition-transform hover:scale-[1.03] sm:px-5 sm:py-2.5 sm:text-sm"><span className="sm:hidden">{t('landing.nav.joinShort')}</span><span className="hidden sm:inline">{t('landing.nav.join')}</span><ArrowUpRight className="hidden h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:block" /></Link></div>
            <button className="ml-0.5 shrink-0 rounded-full p-2 text-white/70 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={t('landing.nav.toggleNav')} aria-expanded={menuOpen}>{menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          </div>
        </div>
        <AnimatePresence>{menuOpen && <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mx-auto mt-2 max-w-[1400px] rounded-2xl border border-white/10 bg-[#07110c]/95 px-3 py-3 shadow-2xl backdrop-blur-xl md:hidden"><div className="flex flex-col gap-1">{links.map((link) => navLink(link, 'cursor-pointer rounded-xl px-4 py-3 text-white/70 hover:bg-white/5 hover:text-white'))}</div></motion.div>}</AnimatePresence>
      </motion.nav>
      <main><HeroSection /><SocialCommerceSection /><FeaturesSection /><BuyerBenefitsSection /><HowItWorks /><RequirementsShowcase /><CTASection /></main><Footer onVisibilityChange={setFooterVisible} /><WhatsAppButton hidden={footerVisible} />
    </div>
  )
}
