import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MapPin, Package, Clock, DollarSign, CheckCircle, Star,
  ChevronLeft, MessageSquare, Users, AlertTriangle, Trophy,
  ThumbsUp, ThumbsDown, Send
} from 'lucide-react'
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPEN:       { label: 'Open',       color: 'text-brand-green bg-brand-green/10 border-brand-green/30' },
  REVIEWING:  { label: 'Reviewing',  color: 'text-gold bg-gold/10 border-gold/30' },
  AWARDED:    { label: 'Awarded',    color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  FULFILLED:  { label: 'Fulfilled',  color: 'text-[var(--c-text-3)] bg-[var(--c-raised)] border-[var(--c-border)]' },
  CANCELLED:  { label: 'Cancelled',  color: 'text-red-400 bg-red-400/10 border-red-400/30' },
}

const BID_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'Pending',     color: 'text-[var(--c-text-3)] bg-[var(--c-raised)] border-[var(--c-border)]' },
  SHORTLISTED: { label: 'Shortlisted', color: 'text-gold bg-gold/10 border-gold/30' },
  ACCEPTED:    { label: 'Accepted',    color: 'text-brand-green bg-brand-green/10 border-brand-green/30' },
  REJECTED:    { label: 'Rejected',    color: 'text-red-400 bg-red-400/10 border-red-400/30' },
  WITHDRAWN:   { label: 'Withdrawn',   color: 'text-[var(--c-text-4)] bg-[var(--c-raised)] border-[var(--c-border)]' },
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
    enabled: !!id,
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
      setBidData({ pricePerUnit: '', totalPrice: '', deliveryTimeline: '', message: '', sampleAvailable: false })
    },
  })

  const updateBidStatus = useMutation({
    mutationFn: async ({ bidId, status }: { bidId: string; status: string }) => {
      await api.put(`/requirements/bids/${bidId}`, { status })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requirement', id] }),
  })

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )
  }

  const req = data?.requirement
  const bids = data?.bids ?? []
  const buyer = req?.buyerId as User
  const isOwner = user?._id === (buyer as any)?._id || user?._id === buyer
  const isFarmer = user?.role === 'FARMER'
  const statusCfg = STATUS_CONFIG[req?.status ?? 'OPEN'] ?? STATUS_CONFIG['OPEN']

  if (!req) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <Package className="h-12 w-12 text-[var(--c-text-4)] mx-auto mb-4" />
      <p className="text-[var(--c-text)] font-semibold">Requirement not found</p>
      <Link to="/requirements" className="mt-4 inline-block text-brand-green text-sm hover:underline">
        Browse requirements
      </Link>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back */}
      <Link to="/requirements" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-text-3)] hover:text-brand-green transition-colors mb-5">
        <ChevronLeft className="h-4 w-4" /> Back to Requirements
      </Link>

      {/* ── REQUIREMENT CARD ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] overflow-hidden mb-5"
      >
        {/* Top accent stripe */}
        <div className={`h-1.5 ${req.isUrgent ? 'bg-gradient-to-r from-red-500 to-orange-400' : 'bg-gradient-to-r from-brand-green to-brand-emerald'}`} />

        <div className="p-6">
          {/* Header row */}
          <div className="flex flex-wrap items-start gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {req.isUrgent && <Badge variant="urgent">Urgent</Badge>}
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              </div>
              <h1 className="text-xl font-bold text-[var(--c-text)] leading-tight">{req.title}</h1>
            </div>
            {req.budgetMax && (
              <div className="bg-[var(--c-raised)] rounded-xl px-4 py-3 text-right border border-[var(--c-border)] flex-shrink-0">
                <p className="text-xs text-[var(--c-text-3)] mb-0.5">Budget</p>
                <p className="font-bold text-[var(--c-text)] text-lg" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(req.budgetMin ?? 0)}–{formatCurrency(req.budgetMax)}
                </p>
                <p className="text-xs text-[var(--c-text-4)]">{req.budgetCurrency}</p>
              </div>
            )}
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-3 text-sm text-[var(--c-text-2)] mb-5">
            <span className="flex items-center gap-1.5 bg-[var(--c-raised)] px-3 py-1.5 rounded-lg border border-[var(--c-border)]">
              <MapPin className="h-3.5 w-3.5 text-brand-green flex-shrink-0" />{req.deliveryLocation}
            </span>
            <span className="flex items-center gap-1.5 bg-[var(--c-raised)] px-3 py-1.5 rounded-lg border border-[var(--c-border)]">
              <Package className="h-3.5 w-3.5 text-brand-green flex-shrink-0" />
              {req.quantityAmount} {req.quantityUnit}
            </span>
            {req.deliveryFrequency && (
              <span className="flex items-center gap-1.5 bg-[var(--c-raised)] px-3 py-1.5 rounded-lg border border-[var(--c-border)]">
                <Clock className="h-3.5 w-3.5 text-brand-green flex-shrink-0" />
                {req.deliveryFrequency}
              </span>
            )}
            {req.deadline && (
              <span className="flex items-center gap-1.5 bg-[var(--c-raised)] px-3 py-1.5 rounded-lg border border-[var(--c-border)] text-[var(--c-text-3)]">
                <AlertTriangle className="h-3.5 w-3.5 text-gold flex-shrink-0" />
                Deadline {new Date(req.deadline).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-[var(--c-text-2)] text-sm leading-relaxed mb-5">{req.description}</p>

          {req.preferredQuality && (
            <div className="bg-[var(--c-raised)] rounded-xl px-4 py-3 mb-5 border border-[var(--c-border)]">
              <p className="text-xs text-[var(--c-text-3)] font-medium mb-1">Preferred Quality</p>
              <p className="text-sm text-[var(--c-text-2)]">{req.preferredQuality}</p>
            </div>
          )}

          {/* Buyer row */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--c-border-sub)]">
            <div className="flex items-center gap-3">
              <Avatar src={buyer?.avatar} name={buyer?.name} size="sm" verified={buyer?.isVerified} />
              <div>
                <p className="text-sm font-semibold text-[var(--c-text)]">{buyer?.name}</p>
                <p className="text-xs text-[var(--c-text-3)] flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {req.bidCount} bids received · {timeAgo(req.createdAt)}
                </p>
              </div>
            </div>
            <Link to={`/messages`}>
              <Button size="sm" variant="outline">
                <MessageSquare className="h-3.5 w-3.5" /> Message
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── BID SUBMISSION (Farmers only) ────────────────────────── */}
      {isFarmer && req.status === 'OPEN' && (
        <div className="mb-6">
          <AnimatePresence mode="wait">
            {!showBidForm ? (
              <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button onClick={() => setShowBidForm(true)} className="w-full" size="lg">
                  <DollarSign className="h-5 w-5" /> Submit Your Bid
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[var(--c-card)] rounded-2xl border-2 border-brand-green/40 p-6 space-y-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-brand-green/10 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-brand-green" />
                  </div>
                  <h2 className="font-bold text-[var(--c-text)] text-lg">Submit Your Bid</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Price per unit (USD)"
                    type="number"
                    placeholder="0.00"
                    value={bidData.pricePerUnit}
                    onChange={(e) => setBidData(p => ({ ...p, pricePerUnit: e.target.value }))}
                  />
                  <Input
                    label="Total Price (USD)"
                    type="number"
                    placeholder="0.00"
                    value={bidData.totalPrice}
                    onChange={(e) => setBidData(p => ({ ...p, totalPrice: e.target.value }))}
                  />
                </div>

                <Input
                  label="Delivery Timeline"
                  placeholder="e.g. Ready in 3–5 business days, FOB Nairobi"
                  value={bidData.deliveryTimeline}
                  onChange={(e) => setBidData(p => ({ ...p, deliveryTimeline: e.target.value }))}
                />

                <div>
                  <label className="text-sm font-medium text-[var(--c-text-2)] mb-1.5 block">
                    Your Message to Buyer
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Tell the buyer why your farm is the best choice. Include certifications, experience, and any added value..."
                    value={bidData.message}
                    onChange={(e) => setBidData(p => ({ ...p, message: e.target.value }))}
                    className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green resize-none transition-colors"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bidData.sampleAvailable}
                    onChange={e => setBidData(p => ({ ...p, sampleAvailable: e.target.checked }))}
                    className="w-4 h-4 accent-brand-green"
                  />
                  <span className="text-sm text-[var(--c-text-2)]">Sample available on request</span>
                </label>

                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setShowBidForm(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => submitBid.mutate()}
                    loading={submitBid.isPending}
                    disabled={!bidData.pricePerUnit || !bidData.totalPrice || !bidData.deliveryTimeline || !bidData.message}
                    className="flex-1"
                  >
                    <Send className="h-4 w-4" /> Submit Bid
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── BIDS SECTION ─────────────────────────────────────────── */}
      <div>
        {/* Section header — visually distinct from the requirement */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-[var(--c-border)]" />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--c-raised)] rounded-full border border-[var(--c-border)]">
            <Trophy className="h-3.5 w-3.5 text-gold" />
            <span className="text-sm font-semibold text-[var(--c-text)]">
              {bids.length} {bids.length === 1 ? 'Bid' : 'Bids'}
            </span>
            <span className="text-xs text-[var(--c-text-3)]">— ranked by best fit</span>
          </div>
          <div className="h-px flex-1 bg-[var(--c-border)]" />
        </div>

        {bids.length === 0 ? (
          <div className="text-center py-12 bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] border-dashed">
            <DollarSign className="h-10 w-10 text-[var(--c-text-4)] mx-auto mb-3" />
            <p className="text-[var(--c-text-2)] font-medium">No bids yet</p>
            <p className="text-[var(--c-text-3)] text-sm mt-1">
              {isFarmer ? 'Be the first to submit a bid above!' : 'Farmers will start bidding soon.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bids.map((bid, i) => {
              const farmer = bid.farmerId as User
              const bidStatusCfg = BID_STATUS_CONFIG[bid.status] ?? BID_STATUS_CONFIG['PENDING']
              const isTopBid = i === 0

              return (
                <motion.div
                  key={bid._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className={`relative rounded-2xl border overflow-hidden ${
                    bid.status === 'ACCEPTED'
                      ? 'border-brand-green bg-brand-green/5'
                      : isTopBid
                        ? 'border-gold/40 bg-[var(--c-card)]'
                        : 'border-[var(--c-border)] bg-[var(--c-card)]'
                  }`}
                >
                  {/* Top bar for rank/status */}
                  {isTopBid && bid.status !== 'ACCEPTED' && (
                    <div className="bg-gradient-to-r from-gold/20 to-transparent px-5 py-2 border-b border-gold/20 flex items-center gap-2">
                      <Trophy className="h-3.5 w-3.5 text-gold" />
                      <span className="text-xs font-semibold text-gold">Top Bid — Best Match</span>
                    </div>
                  )}
                  {bid.status === 'ACCEPTED' && (
                    <div className="bg-brand-green/10 px-5 py-2 border-b border-brand-green/20 flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-brand-green" />
                      <span className="text-xs font-semibold text-brand-green">Bid Accepted — Deal Awarded</span>
                    </div>
                  )}

                  <div className="p-5">
                    {/* Farmer + price row */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <Avatar src={farmer?.avatar} name={farmer?.name} size="md" verified={farmer?.isVerified} />
                          {isTopBid && <span className="absolute -top-1.5 -right-1.5 text-base">🥇</span>}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--c-text)]">{farmer?.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-0.5 text-xs text-[var(--c-text-3)]">
                              <Star className="h-3 w-3 fill-gold text-gold" /> 4.8
                            </span>
                            {farmer?.isVerified && (
                              <span className="text-xs text-brand-green font-medium">✓ Verified</span>
                            )}
                            {bid.sampleAvailable && (
                              <span className="text-xs text-[var(--c-text-3)] bg-[var(--c-raised)] px-2 py-0.5 rounded-full border border-[var(--c-border)]">
                                Sample available
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(bid.totalPrice)}
                        </p>
                        <p className="text-xs text-[var(--c-text-3)]">
                          {formatCurrency(bid.pricePerUnit)} / unit
                        </p>
                        <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full border ${bidStatusCfg.color}`}>
                          {bidStatusCfg.label}
                        </span>
                      </div>
                    </div>

                    {/* Message */}
                    <p className="text-sm text-[var(--c-text-2)] leading-relaxed mb-4 bg-[var(--c-raised)] rounded-xl px-4 py-3 border border-[var(--c-border)]">
                      {bid.message}
                    </p>

                    {/* Delivery + actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-[var(--c-text-3)] flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> {bid.deliveryTimeline}
                      </span>

                      <div className="flex items-center gap-2">
                        <Link to={`/farm/${farmer?.username}`}>
                          <Button size="xs" variant="outline">View Farm</Button>
                        </Link>

                        {/* Buyer actions */}
                        {isOwner && bid.status === 'PENDING' && (
                          <>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => updateBidStatus.mutate({ bidId: bid._id, status: 'REJECTED' })}
                              loading={updateBidStatus.isPending}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="xs"
                              onClick={() => updateBidStatus.mutate({ bidId: bid._id, status: 'ACCEPTED' })}
                              loading={updateBidStatus.isPending}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" /> Accept
                            </Button>
                          </>
                        )}
                        {isOwner && bid.status === 'PENDING' && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => updateBidStatus.mutate({ bidId: bid._id, status: 'SHORTLISTED' })}
                            loading={updateBidStatus.isPending}
                          >
                            Shortlist
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
