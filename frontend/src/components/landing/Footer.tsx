import { Link } from 'react-router-dom'
import { Sprout } from 'lucide-react'

const links = {
  Platform: ['Feed', 'Marketplace', 'Requirements', 'Reels'],
  Farmers: ['Create Store', 'Sell Products', 'Analytics', 'Pricing'],
  Buyers: ['Browse Products', 'Post Requirements', 'Orders', 'Wallet'],
  Company: ['About', 'Blog', 'Careers', 'Contact'],
}

export const Footer = () => (
  <footer className="border-t border-white/[0.06] py-16 px-6">
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-brand-green flex items-center justify-center">
              <Sprout className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              EMAZAO
            </span>
          </Link>
          <p className="text-sm text-white/30 leading-relaxed">
            The digital infrastructure for agriculture.
          </p>
        </div>

        {Object.entries(links).map(([title, items]) => (
          <div key={title}>
            <h4 className="text-sm font-semibold text-white mb-4">{title}</h4>
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item}>
                  <Link
                    to="/"
                    className="text-sm text-white/40 hover:text-white transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-white/30">© 2026 EMAZAO. All rights reserved.</p>
        <div className="flex items-center gap-6">
          {['Privacy', 'Terms', 'Cookies'].map((item) => (
            <Link key={item} to="/" className="text-sm text-white/30 hover:text-white transition-colors">
              {item}
            </Link>
          ))}
        </div>
      </div>
    </div>
  </footer>
)
