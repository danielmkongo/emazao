import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Play, TrendingUp, Globe2, Users, Leaf, Star, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'

const stats = [
  { icon: Globe2,     label: 'African Nations',    value: '54' },
  { icon: TrendingUp, label: 'Global Agri Market', value: '$2T+' },
  { icon: Users,      label: 'Farmers to Reach',   value: '500M+' },
]

const floatingCards = [
  { icon: Leaf, label: 'Organic Coffee', sub: 'James Farm · Kenya', price: '$4.20/kg', color: 'from-brand-green/20 to-brand-green/5', x: '72%', y: '18%', delay: 0 },
  { icon: ShoppingBag, label: 'Hass Avocado', sub: '1,200 units available', price: '$0.85/pc', color: 'from-gold/20 to-gold/5', x: '68%', y: '55%', delay: 0.4 },
  { icon: Star, label: '4.9 ★ Rating', sub: 'Amina · Ethiopia', price: 'Verified Farm', color: 'from-brand-lime/15 to-brand-lime/5', x: '78%', y: '36%', delay: 0.8 },
]

const words: { text: string; gradient: boolean }[] = [
  { text: 'Where ', gradient: false },
  { text: 'Crops', gradient: true },
  { text: ' Meet ', gradient: false },
  { text: 'Commerce', gradient: false },
]

export const HeroSection = () => {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '28%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-12%'])

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden">
      {/* Parallax background */}
      <motion.div className="absolute inset-0 z-0" style={{ y: bgY }}>
        <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/55 via-brand-dark/65 to-brand-dark z-10" />
        <div
          className="w-full h-[130%] -mt-[15%] bg-cover bg-center"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1920&q=80')` }}
        />
      </motion.div>

      {/* Animated ambient orbs */}
      <motion.div
        className="absolute top-1/4 right-1/3 w-[500px] h-[500px] bg-brand-green/12 rounded-full blur-[100px] pointer-events-none"
        animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-gold/8 rounded-full blur-[80px] pointer-events-none"
        animate={{ x: [0, -30, 0], y: [0, 25, 0], scale: [1, 1.18, 1] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <motion.div
        className="absolute top-2/3 right-1/4 w-[300px] h-[300px] bg-brand-lime/6 rounded-full blur-[70px] pointer-events-none"
        animate={{ x: [0, 20, 0], y: [0, -40, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />

      {/* Main content */}
      <motion.div style={{ opacity: contentOpacity, y: contentY }}
        className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-24 w-full">

        <div className="max-w-3xl">
          {/* Live pill */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2.5 glass rounded-full px-5 py-2.5 text-sm text-brand-lime mb-10"
          >
            <motion.span
              className="h-2 w-2 rounded-full bg-brand-green flex-shrink-0"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            The Future of Agricultural Commerce
          </motion.div>

          {/* Headline — word-by-word blur reveal */}
          <h1 className="text-6xl md:text-8xl font-bold text-white leading-[1.05] mb-8 overflow-hidden"
            style={{ fontFamily: 'var(--font-display)' }}>
            {words.map(({ text, gradient }, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 60, filter: 'blur(16px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.25 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={gradient ? 'gradient-text' : ''}
              >
                {text}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-xl text-white/55 mb-12 max-w-2xl leading-relaxed"
          >
            The social-commerce platform where farmers build digital businesses,
            buyers discover trusted suppliers, and agricultural trade happens at scale.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.7 }}
            className="flex flex-wrap items-center gap-4 mb-20"
          >
            <Link to="/register">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                <Button size="xl" className="group shadow-xl shadow-brand-green/30">
                  Start Selling
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </Link>
            <Link to="/marketplace">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                <Button size="xl" variant="glass">
                  <Play className="h-5 w-5 fill-current" />
                  Browse Market
                </Button>
              </motion.div>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="flex flex-wrap gap-8"
          >
            {stats.map(({ icon: Icon, label, value }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-xl bg-brand-green/15 border border-brand-green/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-brand-green" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-sm text-white/40">{label}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Floating product cards — desktop only */}
        <div className="hidden xl:block">
          {floatingCards.map(({ icon: Icon, label, sub, price, color, x, y, delay }) => (
            <motion.div
              key={label}
              className={`absolute bg-gradient-to-br ${color} backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-52 shadow-2xl`}
              style={{ left: x, top: y }}
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
              transition={{
                opacity: { delay: 1.2 + delay, duration: 0.6 },
                scale: { delay: 1.2 + delay, duration: 0.6 },
                y: { delay: 1.2 + delay, duration: 4, repeat: Infinity, ease: 'easeInOut' },
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-white text-xs font-semibold truncate">{label}</span>
              </div>
              <p className="text-white/50 text-[10px] mb-1">{sub}</p>
              <p className="text-brand-lime text-sm font-bold">{price}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
      >
        <div className="h-10 w-6 rounded-full border border-white/20 flex items-start justify-center pt-2">
          <motion.div
            className="h-1.5 w-1.5 rounded-full bg-white/60"
            animate={{ y: [0, 12, 0], opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </section>
  )
}
