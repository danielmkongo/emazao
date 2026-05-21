import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const CTASection = () => (
  <section className="py-32 px-6">
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="max-w-4xl mx-auto text-center"
    >
      <div className="relative rounded-3xl overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-green via-brand-emerald to-brand-dark" />
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(245,158,11,0.4) 0%, transparent 60%)' }}
        />

        <div className="relative z-10 py-20 px-8">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-white/20 items-center justify-center mb-8">
            <Sprout className="h-8 w-8 text-white" />
          </div>
          <h2
            className="text-5xl md:text-6xl font-bold text-white mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Join 50,000+ farmers<br />already trading on EMAZAO
          </h2>
          <p className="text-white/70 text-xl mb-10 max-w-lg mx-auto">
            Build your digital farm, find buyers, and grow your agricultural business today.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/register">
              <Button size="xl" className="bg-white text-brand-dark hover:bg-white/90 font-bold">
                Get Started Free <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/marketplace">
              <Button size="xl" className="bg-white/20 text-white hover:bg-white/30 border border-white/30">
                Browse Products
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  </section>
)
