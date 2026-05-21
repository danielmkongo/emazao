import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Package, Clock, DollarSign, CheckCircle, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, Requirement, Bid, User } from '@/types'

interface RequirementDetailData {
  requirement: Requirement
  bids: Bid[]
}

export default function RequirementDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showBidForm, setShowBidForm] = useState(false)
  const [bidData, setBidData] = useState({
    pricePerUnit: '',
    totalPrice: '',
    deliveryTimeline: '',
    message: '',
    sampleAvailable: false,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['requirement', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RequirementDetailData>>(`/requirements/${id}`)
      return res.data.data
    },
  })

  const submitBid = useMutation({
    mutationFn: async () => {
      await api.post(`/requirements/${id}/bids`, {
        ...bidData,
        pricePerUnit: parseFloat(bidData.pricePerUnit),
        totalPrice: parseFloat(bidData.totalPrice),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requirement', id] })
      setShowBidForm(false)
    },
  })

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    )
  }

  const req = data?.requirement
  const bids = data?.bids ?? []
  const buyer = req?.buyerId as User

  if (!req) return <div className="p-8 text-center text-white/40">Requirement not found</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Requirement card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-800 rounded-2xl border border-white/[0.06] p-6 mb-6"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl font-bold text-white">{req.title}</h1>
              {req.isUrgent && <Badge variant="urgent">Urgent</Badge>}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-white/40">
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{req.deliveryLocation}</span>
              <span className="flex items-center gap-1.5"><Package className="h-4 w-4" />{req.quantityAmount} {req.quantityUnit}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{timeAgo(req.createdAt)}</span>
            </div>
          </div>
          {req.budgetMax && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-white/30">Budget</p>
              <p className="font-semibold text-white">{formatCurrency(req.budgetMin ?? 0)}–{formatCurrency(req.budgetMax)}</p>
            </div>
          )}
        </div>

        <p className="text-white/60 text-sm leading-relaxed mb-5">{req.description}</p>

        <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
          <Avatar src={buyer?.avatar} name={buyer?.name} size="sm" verified={buyer?.isVerified} />
          <div>
            <p className="text-sm font-medium text-white">{buyer?.name}</p>
            <p className="text-xs text-white/40">Buyer • {req.bidCount} bids received</p>
          </div>
        </div>
      </motion.div>

      {/* Bid form for farmers */}
      {user?.role === 'FARMER' && (
        <div className="mb-6">
          {!showBidForm ? (
            <Button onClick={() => setShowBidForm(true)} className="w-full" size="lg">
              Submit Your Bid
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-brand-800 rounded-2xl border border-brand-green/30 p-6 space-y-4"
            >
              <h2 className="font-semibold text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-brand-green" /> Submit Your Bid
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Price per unit (USD)" type="number" placeholder="0.00" value={bidData.pricePerUnit} onChange={(e) => setBidData(p => ({ ...p, pricePerUnit: e.target.value }))} />
                <Input label="Total Price (USD)" type="number" placeholder="0.00" value={bidData.totalPrice} onChange={(e) => setBidData(p => ({ ...p, totalPrice: e.target.value }))} />
              </div>
              <Input label="Delivery Timeline" placeholder="e.g. 3-5 business days" value={bidData.deliveryTimeline} onChange={(e) => setBidData(p => ({ ...p, deliveryTimeline: e.target.value }))} />
              <div>
                <label className="text-sm font-medium text-white/70 mb-1.5 block">Your Message to Buyer</label>
                <textarea
                  rows={3}
                  placeholder="Tell the buyer why your farm is the best choice..."
                  value={bidData.message}
                  onChange={(e) => setBidData(p => ({ ...p, message: e.target.value }))}
                  className="w-full bg-brand-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-brand-green resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowBidForm(false)} className="flex-1">Cancel</Button>
                <Button
                  onClick={() => submitBid.mutate()}
                  loading={submitBid.isPending}
                  className="flex-1"
                >
                  Submit Bid
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Bids list */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">
          {bids.length} Bids <span className="text-white/30 font-normal text-sm">— ranked by best fit</span>
        </h2>
        <div className="space-y-3">
          {bids.map((bid, i) => {
            const farmer = bid.farmerId as User
            return (
              <motion.div
                key={bid._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`bg-brand-800 rounded-2xl border p-5 ${
                  bid.status === 'ACCEPTED' ? 'border-brand-green' : 'border-white/[0.06]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar src={farmer?.avatar} name={farmer?.name} size="md" verified={farmer?.isVerified} />
                      {i === 0 && <span className="absolute -top-1 -right-1 text-sm">🥇</span>}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{farmer?.name}</p>
                      <div className="flex items-center gap-1 text-xs text-white/30">
                        <Star className="h-3 w-3 fill-gold text-gold" /> 4.8 • Verified Farmer
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{formatCurrency(bid.totalPrice)}</p>
                    <p className="text-xs text-white/40">{formatCurrency(bid.pricePerUnit)} / unit</p>
                  </div>
                </div>
                <p className="text-sm text-white/60 mt-3 leading-relaxed">{bid.message}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.06]">
                  <span className="text-xs text-white/30 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {bid.deliveryTimeline}
                  </span>
                  {bid.status === 'ACCEPTED' && (
                    <Badge><CheckCircle className="h-3 w-3" /> Accepted</Badge>
                  )}
                  {user?._id === (req.buyerId as User)?._id && bid.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button size="xs" variant="ghost">Reject</Button>
                      <Button size="xs">Accept Bid</Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
