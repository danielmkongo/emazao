import { Link } from 'react-router-dom'
import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { RequirementsShowcase } from '@/components/landing/RequirementsShowcase'
import { CTASection } from '@/components/landing/CTASection'
import { Footer } from '@/components/landing/Footer'
import { Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Landing() {
  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Public nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-brand-green flex items-center justify-center">
              <Sprout className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              EMAZAO
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
            <Link to="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
            <Link to="/requirements" className="hover:text-white transition-colors">Requirements</Link>
            <Link to="/feed" className="hover:text-white transition-colors">Feed</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <HeroSection />
      <FeaturesSection />
      <HowItWorks />
      <RequirementsShowcase />
      <CTASection />
      <Footer />
    </div>
  )
}
