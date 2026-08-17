import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, BadgeCheck, MessageCircle, ScanSearch, ShieldCheck, Store } from 'lucide-react'
import { Link } from 'react-router-dom'

const features = [
  { icon: Store, n: '01', title: 'Your farm, online', desc: 'Turn every harvest into a beautiful storefront. Add products, prices, availability and the story behind your farm.' },
  { icon: ScanSearch, n: '02', title: 'Demand finds you', desc: 'See active requests from hotels, shops and exporters — then send a competitive bid in minutes.' },
  { icon: MessageCircle, n: '03', title: 'Trade directly', desc: 'Build buyer relationships with real-time chat, live product showcases and transparent order updates.' },
  { icon: ShieldCheck, n: '04', title: 'Money moves safely', desc: 'Escrow, verified profiles and reviews give both sides confidence from agreement to delivery.' },
]

export const FeaturesSection = () => {
  const reduceMotion = useReducedMotion()
  return <section className="bg-[#f2f0e6] px-5 py-24 text-[#102014] sm:px-8 lg:px-12 lg:py-36"><div className="mx-auto max-w-[1440px]">
    <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lg:sticky lg:top-32 lg:self-start"><p className="text-xs font-extrabold uppercase tracking-[.22em] text-green-700">Built for real trade</p><h2 className="mt-5 text-5xl font-semibold leading-[.95] tracking-[-.05em] sm:text-6xl lg:text-7xl" style={{ fontFamily: 'var(--font-display)' }}>Everything between soil and sale.</h2><p className="mt-7 max-w-md text-lg leading-8 text-black/55">One place to be discovered, win new buyers, get paid safely and grow a reputation that travels further than your produce.</p><Link to="/register" className="mt-8 inline-flex items-center gap-2 border-b border-black/30 pb-1 font-bold hover:border-black">See what you can do <ArrowUpRight className="h-4 w-4" /></Link></motion.div>
      <div className="grid gap-px overflow-hidden rounded-[2rem] border border-black/10 bg-black/10 sm:grid-cols-2">{features.map(({ icon: Icon, n, title, desc }, i) => <motion.article key={title} initial={{ opacity: 0, y: reduceMotion ? 0 : 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ delay: i * .08, duration: .6 }} className="group min-h-[300px] bg-[#fbfaf5] p-7 transition-colors hover:bg-[#d9ff43] sm:p-9"><div className="flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#102014] text-white"><Icon className="h-5 w-5" /></div><span className="font-mono text-xs text-black/35">{n}</span></div><h3 className="mt-14 text-2xl font-bold tracking-tight">{title}</h3><p className="mt-4 leading-7 text-black/55 group-hover:text-black/70">{desc}</p></motion.article>)}</div>
    </div>
    <div className="mt-20 grid overflow-hidden rounded-[2rem] bg-[#102014] text-white lg:grid-cols-2"><div className="min-h-[420px] overflow-hidden"><img src="/farmer-market-ready.png" alt="Black African farmer sorting market-ready vegetables on her farm" className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" /></div><div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16"><BadgeCheck className="h-10 w-10 text-[#d9ff43]" /><p className="mt-8 text-3xl font-medium leading-tight sm:text-4xl">“A strong market starts when the farmer is visible, trusted and connected.”</p><div className="mt-10 flex gap-10 border-t border-white/10 pt-7"><div><strong className="text-3xl text-[#d9ff43]">24/7</strong><p className="mt-1 text-sm text-white/45">Open marketplace</p></div><div><strong className="text-3xl text-[#d9ff43]">Escrow</strong><p className="mt-1 text-sm text-white/45">Payment held until you confirm delivery</p></div></div></div></div>
  </div></section>
}
