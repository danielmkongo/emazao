import { motion } from 'framer-motion'
import { Camera, Search, ShieldCheck } from 'lucide-react'

const steps = [
  {
    icon: Camera,
    step: '01',
    title: 'Farmers Create',
    desc: 'Set up your storefront, upload products, post harvest reels, and go live to reach buyers across Africa and beyond.',
    color: 'brand-green',
  },
  {
    icon: Search,
    step: '02',
    title: 'Buyers Discover',
    desc: 'Browse the social feed, post sourcing requirements, and receive bids from verified farms with the best offers.',
    color: 'gold',
  },
  {
    icon: ShieldCheck,
    step: '03',
    title: 'Trade with Trust',
    desc: 'Escrow payments hold funds until delivery. Verified badges, reviews, and dispute protection on every deal.',
    color: 'brand-lime',
  },
]

export const HowItWorks = () => (
  <section className="py-32 px-6 bg-brand-800/30">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-20"
      >
        <span className="text-brand-lime text-sm font-semibold tracking-widest uppercase">How it works</span>
        <h2
          className="text-5xl md:text-6xl font-bold text-white mt-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Simple. Fast. Trusted.
        </h2>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-8 relative">
        {/* Connecting line */}
        <div className="hidden md:block absolute top-16 left-1/4 right-1/4 h-px bg-gradient-to-r from-brand-green via-gold to-brand-lime" />

        {steps.map(({ icon: Icon, step, title, desc, color }, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="flex flex-col items-center text-center"
          >
            <div className={`relative h-16 w-16 rounded-2xl ${
              color === 'brand-green' ? 'bg-brand-green' :
              color === 'gold' ? 'bg-gold' : 'bg-brand-lime'
            } flex items-center justify-center mb-6 shadow-2xl`}>
              <Icon className="h-8 w-8 text-white" />
              <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-brand-dark border border-white/10 text-xs font-bold text-white flex items-center justify-center">
                {step.replace('0', '')}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
            <p className="text-white/50 leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
)
