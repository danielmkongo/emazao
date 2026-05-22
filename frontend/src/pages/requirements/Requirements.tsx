import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Plus, MapPin, Package, Clock, TrendingUp, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, Requirement, User } from '@/types'

export default function Requirements() {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['requirements'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Requirement[]>>('/requirements?limit=50')
      return res.data
    },
  })

  const requirements = data?.data ?? []
  const filtered = requirements.filter(
    (r) =>
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.productType.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-display)' }}>
            Buyer Requirements
          </h1>
          <p className="text-[var(--c-text-3)] text-sm mt-1">Post what you need. Receive bids from verified farmers.</p>
        </div>
        <Link to="/requirements/post">
          <Button className="whitespace-nowrap">
            <Plus className="h-4 w-4" /> Post Requirement
          </Button>
        </Link>
      </motion.div>

      {/* Search + stats */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--c-text-3)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requirements..."
            className="w-full h-11 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl pl-10 pr-4 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green transition-all"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--c-text-3)] px-1">
          <TrendingUp className="h-4 w-4 text-brand-green" />
          <span><span className="font-semibold text-[var(--c-text)]">{filtered.length}</span> open</span>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req, i) => {
            const buyer = req.buyerId as User
            return (
              <motion.div
                key={req._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link to={`/requirements/${req._id}`}>
                  <div className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 hover:border-brand-green/30 hover:shadow-sm transition-all group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-semibold text-[var(--c-text)] group-hover:text-brand-green transition-colors text-sm sm:text-base">
                            {req.title}
                          </h3>
                          {req.isUrgent && <Badge variant="urgent">Urgent</Badge>}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--c-text-3)]">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" /> {req.deliveryLocation}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" /> {req.quantityAmount} {req.quantityUnit}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> {timeAgo(req.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                          <Avatar src={buyer?.avatar} name={buyer?.name} size="xs" />
                          <span className="text-xs text-[var(--c-text-4)]">{buyer?.name}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {req.budgetMax && (
                          <div className="text-right">
                            <p className="text-xs text-[var(--c-text-4)]">Budget</p>
                            <p className="font-semibold text-[var(--c-text)] text-sm">
                              {formatCurrency(req.budgetMin ?? 0)} – {formatCurrency(req.budgetMax)}
                            </p>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-xs text-[var(--c-text-4)]">Bids</p>
                          <p className="text-brand-green font-bold text-xl leading-none">{req.bidCount}</p>
                        </div>
                        {user?.role === 'FARMER' && (
                          <Button size="xs" variant="outline" className="text-xs">
                            Bid Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}

          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-20">
              <span className="text-6xl mb-4 block">📋</span>
              <h3 className="text-lg font-semibold text-[var(--c-text)] mb-2">No requirements found</h3>
              <p className="text-[var(--c-text-3)] text-sm mb-6">Be the first to post what you need.</p>
              <Link to="/requirements/post">
                <Button><Plus className="h-4 w-4" /> Post a Requirement</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
