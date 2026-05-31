import { motion } from 'framer-motion'
import { MapPin, Package, Clock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'

const mockRequirements = [
  {
    id: 1,
    title: '5 Tons of Fresh Tomatoes — Weekly',
    location: 'Dar es Salaam, Tanzania',
    quantity: '5 tons / week',
    budget: '$800–$1,200',
    bids: 12,
    urgent: true,
    buyer: { name: 'Serena Hotels Ltd', type: 'Hotel' },
  },
  {
    id: 2,
    title: 'Organic Maize — 20 Tons Monthly',
    location: 'Nairobi, Kenya',
    quantity: '20 tons / month',
    budget: '$4,000–$6,000',
    bids: 8,
    urgent: false,
    buyer: { name: 'EcoGrain Exports', type: 'Exporter' },
  },
  {
    id: 3,
    title: 'Mixed Tropical Fruits for Export',
    location: 'Lagos, Nigeria',
    quantity: '50 tons / shipment',
    budget: '$15,000+',
    bids: 23,
    urgent: true,
    buyer: { name: 'FreshLink Supermarkets', type: 'Retailer' },
  },
]

export const RequirementsShowcase = () => (
  <section className="py-32 px-6 lg:px-10">
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16"
      >
        <div>
          <span className="text-brand-lime text-sm font-semibold tracking-widest uppercase">Reverse Marketplace</span>
          <h2
            className="text-5xl md:text-6xl font-bold text-white mt-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Buyers post.<br />Farmers bid.
          </h2>
        </div>
        <p className="text-white/50 text-lg max-w-sm">
          Hotels, restaurants, and exporters post what they need. Your farm submits the best offer.
        </p>
      </motion.div>

      <div className="space-y-4">
        {mockRequirements.map((req, i) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ x: 4 }}
            className="glass rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4 group cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className="text-base font-semibold text-white truncate">{req.title}</h3>
                {req.urgent && <Badge variant="urgent">Urgent</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/40">
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {req.location}</span>
                <span className="flex items-center gap-1.5"><Package className="h-4 w-4" /> {req.quantity}</span>
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {req.buyer.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-6 flex-shrink-0">
              <div className="text-right">
                <p className="text-sm text-white/40">Budget</p>
                <p className="font-semibold text-white">{req.budget}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/40">Bids</p>
                <p className="font-bold text-brand-lime text-lg">{req.bids}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-white/20 group-hover:text-brand-green transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-10 text-center"
      >
        <Link to="/requirements">
          <Button size="lg" variant="outline">
            View All Requirements <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  </section>
)
