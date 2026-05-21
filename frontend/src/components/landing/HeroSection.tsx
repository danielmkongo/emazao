import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Play, TrendingUp, Users, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'

const stats = [
  { icon: Users, label: 'Farmers', value: '50K+' },
  { icon: Package, label: 'Products', value: '200K+' },
  { icon: TrendingUp, label: 'Countries', value: '18' },
]

export const HeroSection = () => (
  <section className="relative min-h-screen flex items-center overflow-hidden">
    {/* Cinematic background */}
    <div className="absolute inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/60 via-brand-dark/70 to-brand-dark z-10" />
      <div
        className="w-full h-full bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1920&q=80')`,
        }}
      />
    </div>

    {/* Floating orbs */}
    <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-green/10 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-gold/8 rounded-full blur-3xl pointer-events-none" />

    <div className="relative z-10 max-w-6xl mx-auto px-6 py-32">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl"
      >
        {/* Pill badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-brand-lime mb-8"
        >
          <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse" />
          The Future of Agricultural Commerce
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-6xl md:text-8xl font-bold text-white leading-[1.05] mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Where{' '}
          <span className="gradient-text">Crops</span>
          {' '}Meet{' '}
          <span className="text-white">Commerce</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="text-xl text-white/60 mb-10 max-w-2xl leading-relaxed"
        >
          The social-commerce platform where farmers build digital businesses,
          buyers discover trusted suppliers, and agricultural trade happens at scale.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="flex flex-wrap items-center gap-4 mb-16"
        >
          <Link to="/register">
            <Button size="xl" className="group">
              Start Selling
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link to="/marketplace">
            <Button size="xl" variant="glass">
              <Play className="h-5 w-5 fill-current" />
              Browse Market
            </Button>
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-wrap gap-8"
        >
          {stats.map(({ icon: Icon, label, value }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-brand-green/15 flex items-center justify-center">
                <Icon className="h-5 w-5 text-brand-green" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-sm text-white/40">{label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>

    {/* Scroll indicator */}
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      animate={{ y: [0, 8, 0] }}
      transition={{ repeat: Infinity, duration: 2 }}
    >
      <div className="h-10 w-6 rounded-full border border-white/20 flex items-start justify-center pt-2">
        <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
      </div>
    </motion.div>
  </section>
)
