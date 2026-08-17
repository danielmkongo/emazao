import crypto from 'crypto'
import mongoose from 'mongoose'
import Order from '../../models/Order'
import RiskFlag, { type RiskFlagType, type RiskSeverity } from '../../models/RiskFlag'
import VerificationProfile from '../../models/VerificationProfile'
import AccountFingerprint from '../../models/AccountFingerprint'
import Product from '../../models/Product'
import { env } from '../../config/env'

// ─── Tunables ─────────────────────────────────────────────────────────────────
// Deliberately in one place: these are policy, not logic, and compliance staff
// will want them changed without touching the rules.
export const RISK_CONFIG = {
  /** Orders below this are ignored by the value-based rules entirely. */
  minOrderValue: 10_000,
  structuring: {
    /** Orders landing within this fraction below a threshold look deliberate. */
    proximity: 0.1,
    windowDays: 30,
    minCount: 3,
  },
  velocity: {
    dormantDays: 60,
    /** Multiple of the account's prior 90-day average that counts as a spike. */
    spikeMultiple: 10,
    windowDays: 7,
  },
  /** Below this token-overlap score, a payout wallet name is treated as a mismatch. */
  nameMatchFloor: 0.5,
  circular: { maxDepth: 4, windowDays: 60 },
  priceAnomaly: { deviation: 3 },
} as const

function hash(value: string): string {
  return crypto.createHmac('sha256', env.FINGERPRINT_SALT).update(String(value ?? '')).digest('hex')
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

/**
 * Records a flag, relying on the partial unique index to keep re-runs idempotent —
 * an engine pass over the same order must not stack duplicates onto a finding a
 * reviewer already has open.
 */
async function raise(flag: {
  type: RiskFlagType
  severity: RiskSeverity
  userId: mongoose.Types.ObjectId | string
  relatedUserId?: mongoose.Types.ObjectId | string
  orderId?: mongoose.Types.ObjectId | string
  detail: string
  evidence?: Record<string, unknown>
  blockedPayout?: boolean
}): Promise<boolean> {
  try {
    await RiskFlag.create({ ...flag, status: 'OPEN' })
    return true
  } catch (err: any) {
    if (err.code === 11000) return false // already open — not an error
    throw err
  }
}

export async function recordFingerprint(userId: string, ip?: string, userAgent?: string): Promise<void> {
  if (!ip && !userAgent) return
  const ipHash = hash(ip ?? 'unknown')
  const uaHash = hash(userAgent ?? 'unknown')
  await AccountFingerprint.findOneAndUpdate(
    { userId, ipHash, uaHash },
    { $set: { lastSeen: new Date() }, $inc: { hits: 1 }, $setOnInsert: { firstSeen: new Date() } },
    { upsert: true },
  )
}

// ─── Rules ────────────────────────────────────────────────────────────────────

/**
 * One party on both sides. The clearest laundering shape there is: you cannot
 * launder through a marketplace without controlling both the money going in and
 * the "goods" going out.
 */
async function checkSelfDealing(order: any): Promise<void> {
  const buyerId = order.buyerId.toString()
  const sellerId = order.sellerId.toString()
  if (buyerId === sellerId) {
    await raise({
      type: 'SELF_DEALING', severity: 'HIGH', userId: sellerId, relatedUserId: buyerId,
      orderId: order._id, detail: 'Buyer and seller are the same account.', blockedPayout: true,
    })
    return
  }

  const [buyerProfile, sellerProfile] = await Promise.all([
    VerificationProfile.findOne({ userId: buyerId }).select('nidaHash payoutPhone').lean(),
    VerificationProfile.findOne({ userId: sellerId }).select('nidaHash payoutPhone').lean(),
  ])

  // Same national ID or same payout wallet on both sides is near-conclusive.
  if (buyerProfile?.nidaHash && buyerProfile.nidaHash === sellerProfile?.nidaHash) {
    await raise({
      type: 'SELF_DEALING', severity: 'HIGH', userId: sellerId, relatedUserId: buyerId,
      orderId: order._id, detail: 'Buyer and seller accounts share the same national ID.',
      blockedPayout: true,
    })
    return
  }
  if (buyerProfile?.payoutPhone && buyerProfile.payoutPhone === sellerProfile?.payoutPhone) {
    await raise({
      type: 'SELF_DEALING', severity: 'HIGH', userId: sellerId, relatedUserId: buyerId,
      orderId: order._id, detail: 'Buyer and seller accounts share the same payout wallet.',
      blockedPayout: true,
    })
    return
  }

  // Shared device/network is suggestive, not conclusive — families share phones
  // and whole villages share one NAT. Medium severity, and it does not block.
  const buyerPrints = await AccountFingerprint.find({ userId: buyerId }).select('ipHash uaHash').lean()
  if (!buyerPrints.length) return

  const shared = await AccountFingerprint.findOne({
    userId: sellerId,
    $or: buyerPrints.map(p => ({ ipHash: p.ipHash, uaHash: p.uaHash })),
  }).lean()

  if (shared) {
    await raise({
      type: 'SELF_DEALING', severity: 'MEDIUM', userId: sellerId, relatedUserId: buyerId,
      orderId: order._id,
      detail: 'Buyer and seller used the same device and network. May be legitimate (shared phone or cybercafé) — confirm before acting.',
      evidence: { ipHash: shared.ipHash },
    })
  }
}

/** Orders repeatedly parked just below a threshold to avoid triggering review. */
async function checkStructuring(order: any, threshold: number): Promise<void> {
  const { proximity, windowDays, minCount } = RISK_CONFIG.structuring
  const floor = threshold * (1 - proximity)
  if (order.total < floor || order.total >= threshold) return

  const near = await Order.countDocuments({
    sellerId: order.sellerId,
    createdAt: { $gte: daysAgo(windowDays) },
    total: { $gte: floor, $lt: threshold },
    status: { $nin: ['CANCELLED', 'REFUNDED'] },
  })

  if (near >= minCount) {
    await raise({
      type: 'STRUCTURING', severity: 'HIGH', userId: order.sellerId, orderId: order._id,
      detail: `${near} orders in ${windowDays} days sit just below the ${threshold.toLocaleString()} review threshold.`,
      evidence: { count: near, threshold, floor },
      blockedPayout: true,
    })
  }
}

/** A quiet account that suddenly moves serious volume. */
async function checkVelocity(order: any): Promise<void> {
  const { dormantDays, spikeMultiple, windowDays } = RISK_CONFIG.velocity

  const recentTotal = await Order.aggregate([
    {
      $match: {
        sellerId: new mongoose.Types.ObjectId(order.sellerId),
        createdAt: { $gte: daysAgo(windowDays) },
        status: { $nin: ['CANCELLED', 'REFUNDED'] },
      },
    },
    { $group: { _id: null, sum: { $sum: '$total' }, count: { $sum: 1 } } },
  ])
  const recent = recentTotal[0]
  if (!recent) return

  const priorAgg = await Order.aggregate([
    {
      $match: {
        sellerId: new mongoose.Types.ObjectId(order.sellerId),
        createdAt: { $gte: daysAgo(90), $lt: daysAgo(windowDays) },
        status: { $nin: ['CANCELLED', 'REFUNDED'] },
      },
    },
    { $group: { _id: null, sum: { $sum: '$total' } } },
  ])
  const prior = priorAgg[0]?.sum ?? 0

  // A brand-new seller has no baseline; their first sales are not a "spike".
  const firstOrder = await Order.findOne({ sellerId: order.sellerId }).sort({ createdAt: 1 }).select('createdAt').lean()
  const accountAgeDays = firstOrder
    ? (Date.now() - new Date(firstOrder.createdAt).getTime()) / (24 * 60 * 60 * 1000)
    : 0
  if (accountAgeDays < dormantDays) return

  const baseline = prior / ((90 - windowDays) / windowDays)
  if (baseline > 0 && recent.sum > baseline * spikeMultiple) {
    await raise({
      type: 'VELOCITY_SPIKE', severity: 'MEDIUM', userId: order.sellerId, orderId: order._id,
      detail: `Sales in the last ${windowDays} days are ${Math.round(recent.sum / baseline)}× this account's usual rate.`,
      evidence: { recent: recent.sum, baseline: Math.round(baseline), orders: recent.count },
    })
  }
}

/** Order priced far away from the listing it references. */
async function checkPriceAnomaly(order: any): Promise<void> {
  for (const item of order.items ?? []) {
    if (!item.productId || !item.unitPrice) continue
    const product = await Product.findById(item.productId).select('price').lean()
    if (!product?.price) continue

    const ratio = item.unitPrice / product.price
    if (ratio > RISK_CONFIG.priceAnomaly.deviation || ratio < 1 / RISK_CONFIG.priceAnomaly.deviation) {
      await raise({
        type: 'PRICE_ANOMALY', severity: 'HIGH', userId: order.sellerId, orderId: order._id,
        detail: `Sold at ${item.unitPrice.toLocaleString()} against a listed price of ${product.price.toLocaleString()} (${ratio.toFixed(1)}×). Over- and under-invoicing is a common way to move value.`,
        evidence: { unitPrice: item.unitPrice, listedPrice: product.price, ratio },
        blockedPayout: true,
      })
      return
    }
  }
}

/**
 * Value returning to where it started, through intermediaries — A sells to B,
 * B sells to C, C sells back to A. Walks the trade graph outward from the seller
 * looking for a path back to the buyer.
 */
async function checkCircularTrading(order: any): Promise<void> {
  const { maxDepth, windowDays } = RISK_CONFIG.circular
  const origin = order.buyerId.toString()
  const since = daysAgo(windowDays)

  let frontier = [order.sellerId.toString()]
  const seen = new Set<string>([order.sellerId.toString()])

  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = await Order.find({
      buyerId: { $in: frontier.map(id => new mongoose.Types.ObjectId(id)) },
      createdAt: { $gte: since },
      status: { $nin: ['CANCELLED', 'REFUNDED'] },
    }).select('sellerId').lean()

    const sellers = next.map(o => o.sellerId.toString())
    if (sellers.includes(origin)) {
      await raise({
        type: 'CIRCULAR_TRADING', severity: 'HIGH', userId: order.sellerId,
        relatedUserId: origin, orderId: order._id,
        detail: `Value returns to the buyer through a chain of ${depth + 1} accounts — a closed trading loop.`,
        evidence: { depth: depth + 1 },
        blockedPayout: true,
      })
      return
    }

    frontier = sellers.filter(id => !seen.has(id))
    frontier.forEach(id => seen.add(id))
    if (!frontier.length) return
  }
}

/**
 * Runs every order-level rule. Called after an order is paid — failures are
 * logged and swallowed so a monitoring bug can never block a legitimate sale.
 */
export async function screenOrder(orderId: string, reviewThreshold: number): Promise<void> {
  try {
    const order = await Order.findById(orderId).lean()
    if (!order || order.total < RISK_CONFIG.minOrderValue) return

    await Promise.all([
      checkSelfDealing(order),
      checkStructuring(order, reviewThreshold),
      checkVelocity(order),
      checkPriceAnomaly(order),
      checkCircularTrading(order),
    ])
  } catch (err: any) {
    console.error('[risk] screenOrder failed:', err.message)
  }
}

/** Is this account currently blocked from taking money out? */
export async function hasBlockingFlags(userId: string): Promise<boolean> {
  return (await RiskFlag.exists({ userId, status: 'OPEN', blockedPayout: true })) !== null
}
