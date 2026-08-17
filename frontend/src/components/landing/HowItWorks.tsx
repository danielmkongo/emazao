import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, BadgeCheck, MessagesSquare, Store, WalletCards } from 'lucide-react'

const steps = [
  { icon: Store, step: '01', title: 'Set up your farm', desc: 'Create a trusted profile and turn what you grow into a storefront buyers can browse any time.', detail: 'Products · harvest dates · quantities' },
  { icon: MessagesSquare, step: '02', title: 'Meet the right buyer', desc: 'Respond to active requests or let hotels, retailers and exporters discover your produce.', detail: 'Direct chat · bids · live selling' },
  { icon: WalletCards, step: '03', title: 'Agree, deliver, get paid', desc: 'Confirm the order, track delivery and release payment through protected escrow.', detail: 'Escrow · order tracking · reviews' },
]

export const HowItWorks = () => {
  const reduceMotion = useReducedMotion()
  return <section id="how-it-works" className="relative overflow-hidden bg-[#07110c] px-5 py-24 sm:px-8 lg:px-12 lg:py-36">
    <div className="pointer-events-none absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-green-500/[.07] blur-[100px]" />
    <div className="relative mx-auto max-w-[1440px]">
      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid gap-8 border-b border-white/10 pb-14 lg:grid-cols-2 lg:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.22em] text-[#d9ff43]">How eMazao works</p><h2 className="mt-5 text-5xl font-semibold leading-[.92] tracking-[-.05em] sm:text-6xl lg:text-7xl" style={{ fontFamily: 'var(--font-display)' }}>Three steps.<br />One clear path.</h2></div><p className="max-w-lg text-lg leading-8 text-white/50 lg:justify-self-end">From the first listing to the final payment, eMazao keeps every conversation, agreement and milestone in one place.</p></motion.div>
      <div className="mt-8 grid lg:grid-cols-3">{steps.map(({ icon: Icon, step, title, desc, detail }, i) => <motion.article key={step} initial={{ opacity: 0, y: reduceMotion ? 0 : 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .3 }} transition={{ duration: .65, delay: i * .12 }} className="group relative border-b border-white/10 py-10 lg:border-b-0 lg:border-r lg:px-9 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"><div className="flex items-center justify-between"><span className="font-mono text-sm text-[#d9ff43]">/{step}</span><div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[.04] transition-colors group-hover:border-[#d9ff43]/30 group-hover:bg-[#d9ff43] group-hover:text-[#102014]"><Icon className="h-6 w-6" /></div></div><h3 className="mt-16 text-3xl font-semibold tracking-tight">{title}</h3><p className="mt-5 max-w-sm leading-7 text-white/50">{desc}</p><p className="mt-10 flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-white/35"><BadgeCheck className="h-4 w-4 text-[#d9ff43]" />{detail}</p>{i < 2 && <ArrowDown className="absolute -bottom-3 right-3 z-10 h-6 w-6 rounded-full bg-[#07110c] p-1 text-white/30 lg:hidden" />}</motion.article>)}</div>
    </div>
  </section>
}
