import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, BadgeCheck, Radio, ScanSearch, ShieldCheck, Store } from 'lucide-react'
import { Link } from 'react-router-dom'

const features = [
  { icon: Store, n: '01', title: 'Your farm, online', desc: 'Turn every harvest into a beautiful storefront. Add products, prices, availability and the story behind your farm.' },
  { icon: Radio, n: '02', title: 'Build an audience', desc: 'Share harvest updates, short videos and live showcases that buyers can shop directly.' },
  { icon: ScanSearch, n: '03', title: 'Demand finds you', desc: 'See active requests from hotels, shops and exporters—then send a competitive bid in minutes.' },
  { icon: ShieldCheck, n: '04', title: 'Escrow-protected payments', desc: 'Funds are held securely until delivery is confirmed. If something goes wrong, our support team steps in to review and resolve the dispute — neither side is left to sort it out alone.' },
]

export const FeaturesSection = () => {
  const reduceMotion = useReducedMotion()
  return <section className="bg-[#f2f0e6] px-5 py-24 text-[#102014] sm:px-8 lg:px-12 lg:py-28"><div className="mx-auto max-w-[1440px]">
    <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lg:sticky lg:top-32 lg:self-start"><p className="text-xs font-extrabold uppercase tracking-[.22em] text-green-700">Built for farmers</p><h2 className="mt-5 text-5xl font-semibold leading-[.95] tracking-[-.05em] sm:text-6xl lg:text-7xl" style={{ fontFamily: 'var(--font-display)' }}>Everything between soil and sale.</h2><p className="mt-7 max-w-md text-lg leading-8 text-black/60">One place to be discovered, win new buyers, get paid safely and grow a reputation that travels further than your produce.</p><Link to="/register?intent=sell" className="mt-8 inline-flex items-center gap-2 border-b border-black/30 pb-1 font-bold hover:border-black">Start selling on eMazao <ArrowUpRight className="h-4 w-4" /></Link></motion.div>
      <div className="grid gap-px overflow-hidden rounded-[2rem] border border-black/10 bg-black/10 sm:grid-cols-2">{features.map(({ icon: Icon, n, title, desc }, i) => <motion.article key={title} initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ delay: i * .07, duration: .55 }} className="group min-h-[270px] bg-[#fbfaf5] p-7 transition-colors hover:bg-[#d9ff43] sm:p-9"><div className="flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#102014] text-white"><Icon className="h-5 w-5" /></div><span className="font-mono text-xs text-black/40">{n}</span></div><h3 className="mt-10 text-2xl font-bold tracking-tight">{title}</h3><p className="mt-4 leading-7 text-black/60 group-hover:text-black/70">{desc}</p></motion.article>)}</div>
    </div>
    <div className="mt-20 grid overflow-hidden rounded-[2rem] bg-[#102014] text-white lg:grid-cols-2"><div className="min-h-[420px] overflow-hidden"><img src="/farmers-market-ready-v2.png" alt="Two Black African farmers smiling as they prepare market-ready vegetables together" className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" /></div><div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16"><BadgeCheck className="h-10 w-10 text-[#d9ff43]" /><p className="mt-8 text-3xl font-medium leading-tight sm:text-4xl">A stronger market starts when farmers are visible, trusted and directly connected to demand.</p><div className="mt-10 flex flex-col gap-6 border-t border-white/10 pt-7 sm:flex-row sm:gap-10"><div><strong className="text-2xl text-[#d9ff43] sm:text-3xl">24/7 marketplace</strong><p className="mt-1 text-sm text-white/60">Your storefront works around the clock</p></div><div><strong className="text-2xl text-[#d9ff43] sm:text-3xl">Escrow protected</strong><p className="mt-1 text-sm text-white/60">Funds are held until delivery is confirmed</p></div></div></div></div>
  </div></section>
}
