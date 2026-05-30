import { motion } from 'framer-motion'
import { Camera, Search, ShieldCheck } from 'lucide-react'

const steps = [
  {
    icon: Camera,
    step: '01',
    title: 'Farmers Create',
    desc: 'Set up your storefront, upload products, post harvest reels, and go live to reach buyers across Africa and beyond.',
    color: 'brand-green',
    glow: 'shadow-brand-green/40',
  },
  {
    icon: Search,
    step: '02',
    title: 'Buyers Discover',
    desc: 'Browse the social feed, post sourcing requirements, and receive bids from verified farms with the best offers.',
    color: 'gold',
    glow: 'shadow-gold/40',
  },
  {
    icon: ShieldCheck,
    step: '03',
    title: 'Trade with Trust',
    desc: 'Escrow payments hold funds until delivery. Verified badges, reviews, and dispute protection on every deal.',
    color: 'brand-lime',
    glow: 'shadow-brand-lime/40',
  },
]

const colorClass: Record<string, string> = {
  'brand-green': 'bg-brand-green',
  'gold': 'bg-gold',
  'brand-lime': 'bg-brand-lime',
}

export const HowItWorks = () => (
  <section className="py-32 px-6 bg-brand-800/30 overflow-hidden">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-20"
      >
        <motion.span
          initial={{ opacity: 0, letterSpacing: '0.3em' }}
          whileInView={{ opacity: 1, letterSpacing: '0.2em' }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-brand-lime text-sm font-semibold tracking-widest uppercase"
        >
          How it works
        </motion.span>
        <h2
          className="text-5xl md:text-6xl font-bold text-white mt-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Simple. Fast. Trusted.
        </h2>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-8 relative">
        {/* Animated connecting line */}
        <div className="hidden md:block absolute top-16 left-[22%] right-[22%]">
          <div className="h-px bg-white/10 w-full" />
          <motion.div
            className="h-px bg-gradient-to-r from-brand-green via-gold to-brand-lime absolute top-0 left-0"
            initial={{ width: '0%' }}
            whileInView={{ width: '100%' }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {steps.map(({ icon: Icon, step, title, desc, color, glow }, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 50, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.18, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: [-2, 2, -2, 0] }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className={`relative h-16 w-16 rounded-2xl ${colorClass[color]} flex items-center justify-center mb-6 shadow-2xl ${glow}`}
            >
              <Icon className="h-8 w-8 text-white" />
              <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-brand-dark border border-white/10 text-xs font-bold text-white flex items-center justify-center">
                {step.replace('0', '')}
              </span>
            </motion.div>
            <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
            <p className="text-white/50 leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
)
