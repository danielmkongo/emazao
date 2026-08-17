import { useState } from 'react'
import { AnimatePresence, motion, useScroll } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { RequirementsShowcase } from '@/components/landing/RequirementsShowcase'
import { CTASection } from '@/components/landing/CTASection'
import { Footer } from '@/components/landing/Footer'

const links = [{ label: 'Marketplace', to: '/marketplace' }, { label: 'How it works', to: '/#how-it-works' }, { label: 'Buyer requests', to: '/requirements' }]

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)
  const { scrollYProgress } = useScroll()
  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-brand-dark text-white" data-theme="dark">
      <motion.div className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-brand-lime" style={{ scaleX: scrollYProgress }} />
      <motion.nav animate={{ opacity: footerVisible ? 0 : 1, y: footerVisible ? -24 : 0, pointerEvents: footerVisible ? 'none' : 'auto' }} transition={{ duration: .3, ease: [0.16, 1, 0.3, 1] }} className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 sm:gap-3">
          <Link to="/" aria-label="eMazao home" className="flex h-16 shrink-0 items-center px-1">
            <Logo className="h-[58px] w-auto drop-shadow-[0_5px_16px_rgba(0,0,0,.55)] sm:h-[68px]" />
          </Link>
          <div className="flex h-13 min-w-0 flex-1 items-center rounded-full border border-white/[0.09] bg-[#07110c]/76 px-1.5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:h-14 sm:px-2">
            <div className="hidden items-center gap-8 pl-5 md:flex lg:gap-10">{links.map((link) => <Link key={link.label} to={link.to} className="text-sm font-medium text-white/60 transition-colors hover:text-white">{link.label}</Link>)}</div>
            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1"><Link to="/login" className="px-2 py-2 text-[11px] font-semibold text-white/70 hover:text-white sm:px-3 sm:text-sm">Sign in</Link><Link to="/register" className="group flex items-center gap-1.5 rounded-full bg-[#d9ff43] px-3 py-2 text-[11px] font-bold text-[#0b160e] transition-transform hover:scale-[1.03] sm:px-5 sm:py-2.5 sm:text-sm"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Join eMazao</span><ArrowUpRight className="hidden h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:block" /></Link></div>
            <button className="ml-0.5 shrink-0 rounded-full p-2 text-white/70 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}>{menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          </div>
        </div>
        <AnimatePresence>{menuOpen && <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mx-auto mt-2 max-w-[1400px] rounded-2xl border border-white/10 bg-[#07110c]/95 px-3 py-3 shadow-2xl backdrop-blur-xl md:hidden"><div className="flex flex-col gap-1">{links.map((link) => <Link key={link.label} to={link.to} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-white/70 hover:bg-white/5 hover:text-white">{link.label}</Link>)}</div></motion.div>}</AnimatePresence>
      </motion.nav>
      <main><HeroSection /><FeaturesSection /><HowItWorks /><RequirementsShowcase /><CTASection /></main><Footer onVisibilityChange={setFooterVisible} />
    </div>
  )
}
