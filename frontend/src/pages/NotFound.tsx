import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sprout, ArrowLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'

/**
 * Real 404 rather than a silent redirect to "/".
 *
 * Product and reel links get shared outside the app (WhatsApp especially), so a
 * dead or mistyped link is a normal occurrence. Bouncing those visitors to the
 * landing page made it look like the link had worked and the content had simply
 * vanished — this tells them what happened and offers a way onward.
 */
export default function NotFound() {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuthStore()

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 bg-[var(--c-bg)]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="w-16 h-16 rounded-2xl bg-brand-green/10 flex items-center justify-center mx-auto mb-5">
          <Sprout className="h-8 w-8 text-brand-green/60" />
        </div>

        <h1 className="text-2xl font-bold text-[var(--c-text)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          This page isn't here
        </h1>
        <p className="text-[var(--c-text-3)] text-sm mb-1">
          The link may be mistyped, or the listing may have been sold or removed.
        </p>
        <p className="text-[var(--c-text-4)] text-xs mb-7 break-all font-mono">{pathname}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to={isAuthenticated ? '/feed' : '/'}>
            <Button className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              {isAuthenticated ? 'Back to your feed' : 'Back to home'}
            </Button>
          </Link>
          <Link to="/marketplace">
            <Button variant="outline" className="w-full sm:w-auto">
              <Search className="h-4 w-4" />
              Browse produce
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
