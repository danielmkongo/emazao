import { Link } from 'react-router-dom'
import { ArrowUpRight, Globe2 as Instagram, MessageCircle as Linkedin, Share2 as Youtube } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { motion } from 'framer-motion'

const links = { Explore: [['Marketplace', '/marketplace'], ['Buyer requests', '/requirements'], ['Community feed', '/feed'], ['Live & reels', '/reels']], Grow: [['Open a storefront', '/register'], ['Sell produce', '/register'], ['Sign in', '/login'], ['Your wallet', '/wallet']], Company: [['About eMazao', '/'], ['Help centre', '/'], ['Contact', '/'], ['Privacy', '/']] }

export const Footer = ({ onVisibilityChange }: { onVisibilityChange?: (visible: boolean) => void }) => <motion.footer onViewportEnter={() => onVisibilityChange?.(true)} onViewportLeave={() => onVisibilityChange?.(false)} viewport={{ amount: 0.08 }} className="bg-[#07110c] px-5 pb-8 pt-20 sm:px-8 lg:px-12"><div className="mx-auto max-w-[1440px]">
  <div className="grid gap-14 border-b border-white/10 pb-16 lg:grid-cols-[1.3fr_2fr]"><div><Link to="/" aria-label="eMazao home" className="inline-flex"><Logo className="h-32 w-auto" /></Link><p className="mt-5 max-w-sm text-lg leading-7 text-white/45">Africa's marketplace for fresh produce, trusted relationships and better agricultural trade.</p><div className="mt-7 flex gap-3">{[Instagram, Linkedin, Youtube].map((Icon, i) => <a key={i} href="#" aria-label="Social media" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/45 transition-colors hover:border-[#d9ff43]/50 hover:text-[#d9ff43]"><Icon className="h-4 w-4" /></a>)}</div></div>
    <div className="grid grid-cols-2 gap-9 sm:grid-cols-3">{Object.entries(links).map(([title, items]) => <div key={title}><h3 className="text-xs font-bold uppercase tracking-[.18em] text-white/30">{title}</h3><ul className="mt-6 space-y-4">{items.map(([label, to]) => <li key={label}><Link to={to} className="group inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">{label}<ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" /></Link></li>)}</ul></div>)}</div>
  </div>
  <div className="flex flex-col gap-3 pt-7 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between"><p>© 2026 eMazao. Mazao yako, soko lako.</p><p>Built for the people who feed us.</p></div>
</div></motion.footer>
