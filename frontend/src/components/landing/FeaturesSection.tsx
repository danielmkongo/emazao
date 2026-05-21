import { motion } from 'framer-motion'
import { Sprout, Users, ShoppingBag, Zap, Shield, TrendingUp } from 'lucide-react'

const features = [
  {
    icon: Sprout,
    title: 'Farm Storefronts',
    desc: 'Build your digital farm. Upload products, post reels, go live, and grow your audience like a creator.',
    color: 'brand-green',
  },
  {
    icon: Users,
    title: 'Buyer Requirements',
    desc: 'Post what you need. Farmers bid. The best supplier wins. A reverse marketplace for agricultural procurement.',
    color: 'gold',
  },
  {
    icon: ShoppingBag,
    title: 'Social Commerce Feed',
    desc: 'A TikTok-style feed of crops, reels, and farm stories. Discover, engage, and buy — all in one scroll.',
    color: 'brand-lime',
  },
  {
    icon: Shield,
    title: 'Escrow Protection',
    desc: 'Funds held securely until delivery confirmed. Trust built into every transaction.',
    color: 'brand-green',
  },
  {
    icon: TrendingUp,
    title: 'AI Analytics',
    desc: 'AI-powered insights, pricing suggestions, and demand forecasting for smarter farming decisions.',
    color: 'gold',
  },
  {
    icon: Zap,
    title: 'Real-time Commerce',
    desc: 'Live bidding, instant messaging, live-stream sales, and real-time order tracking.',
    color: 'brand-lime',
  },
]

const colorMap: Record<string, string> = {
  'brand-green': 'from-brand-green/20 to-brand-green/5 border-brand-green/20 text-brand-green',
  'gold': 'from-gold/20 to-gold/5 border-gold/20 text-gold',
  'brand-lime': 'from-brand-lime/20 to-brand-lime/5 border-brand-lime/20 text-brand-lime',
}

export const FeaturesSection = () => (
  <section className="py-32 px-6">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-20"
      >
        <span className="text-brand-lime text-sm font-semibold tracking-widest uppercase">Platform</span>
        <h2
          className="text-5xl md:text-6xl font-bold text-white mt-4 mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Everything agriculture needs
        </h2>
        <p className="text-white/50 text-xl max-w-2xl mx-auto">
          One platform. Every tool a modern farmer or buyer needs to trade at scale.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map(({ icon: Icon, title, desc, color }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ y: -4, scale: 1.01 }}
            className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-6 cursor-default`}
          >
            <div className={`h-12 w-12 rounded-xl bg-brand-dark flex items-center justify-center mb-5 ${colorMap[color].split(' ')[3]}`}>
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
)
