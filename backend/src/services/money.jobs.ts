/**
 * Background jobs that keep money moving when nobody presses a button:
 *
 * - Sellers are paid automatically AUTO_RELEASE_DAYS after dispatch unless the
 *   buyer reported a problem, so a buyer who never taps "confirm" cannot leave
 *   a farmer's money locked forever.
 * - Recent payment prompts are checked with the provider, so a lost or
 *   misconfigured webhook never leaves a paid order looking unpaid.
 * - Pending withdrawals are checked until the provider says delivered or
 *   failed; failed ones go back to the seller's balance.
 * - Orders nobody paid for are cancelled after a few days so they stop
 *   cluttering both sides' order lists.
 */
import Order from '../models/Order'
import Checkout from '../models/Checkout'
import Wallet from '../models/Wallet'
import { env } from '../config/env'
import {
  AUTO_RELEASE_DAYS, collectionRef, checkoutRef,
  releaseEscrow, reconcileCollection, reconcilePayout,
} from './money.service'

const DAY = 86_400_000
const UNPAID_EXPIRY_DAYS = 3

export async function autoReleaseEscrows() {
  const cutoff = new Date(Date.now() - AUTO_RELEASE_DAYS * DAY)
  const due = await Order.find({
    status: { $in: ['SHIPPED', 'DELIVERED'] },
    escrowId: { $exists: true },
    $or: [{ shippedAt: { $lte: cutoff } }, { shippedAt: { $exists: false }, dispatchedAt: { $lte: cutoff } }],
  }).select('_id').limit(200).lean()
  let released = 0
  for (const o of due) {
    const r = await releaseEscrow(String(o._id), 'AUTO').catch(() => ({ released: false }))
    if (r.released) released++
  }
  return released
}

function providerConfigured() {
  return env.PAYMENT_PROVIDER !== 'clickpesa' || (!!env.CLICKPESA_CLIENT_ID && !!env.CLICKPESA_API_KEY)
}

export async function reconcileRecentCollections() {
  if (!providerConfigured()) return 0
  const since = new Date(Date.now() - DAY)
  const [orders, checkouts] = await Promise.all([
    Order.find({ status: 'PENDING', collectionRequestedAt: { $gte: since } }).select('_id checkoutId').limit(100).lean(),
    Checkout.find({ status: 'PENDING', collectionRequestedAt: { $gte: since } }).select('_id').limit(100).lean(),
  ])
  let checked = 0
  for (const c of checkouts) { await reconcileCollection(checkoutRef(String(c._id))).catch(() => {}); checked++ }
  // Orders in a checkout are settled through it.
  for (const o of orders.filter(o => !o.checkoutId)) { await reconcileCollection(collectionRef(String(o._id))).catch(() => {}); checked++ }
  return checked
}

export async function reconcilePendingPayouts() {
  if (!providerConfigured()) return 0
  const olderThan = new Date(Date.now() - 60_000)
  const wallets = await Wallet.find({ transactions: { $elemMatch: { type: 'WITHDRAWAL', status: 'pending', createdAt: { $lte: olderThan } } } })
    .select('transactions').limit(100).lean()
  let checked = 0
  for (const w of wallets) {
    for (const t of w.transactions ?? []) {
      if (t.type === 'WITHDRAWAL' && t.status === 'pending' && t.reference) {
        await reconcilePayout(t.reference).catch(() => {})
        checked++
      }
    }
  }
  return checked
}

export async function expireUnpaidOrders() {
  const cutoff = new Date(Date.now() - UNPAID_EXPIRY_DAYS * DAY)
  // A payment prompt in the last day means money may still be on its way.
  const recentPrompt = new Date(Date.now() - DAY)
  const stale = { status: 'PENDING' as const, createdAt: { $lte: cutoff }, $or: [{ collectionRequestedAt: { $exists: false } }, { collectionRequestedAt: { $lte: recentPrompt } }] }
  const res = await Order.updateMany(stale, {
    status: 'CANCELLED',
    $push: { trackingEvents: { status: 'CANCELLED', note: `Not paid within ${UNPAID_EXPIRY_DAYS} days`, at: new Date() } },
  })
  await Checkout.updateMany({ status: 'PENDING', createdAt: { $lte: cutoff }, $or: [{ collectionRequestedAt: { $exists: false } }, { collectionRequestedAt: { $lte: recentPrompt } }] }, { status: 'CANCELLED' })
  return res.modifiedCount
}

let timers: ReturnType<typeof setInterval>[] = []

export function startMoneyJobs() {
  if (timers.length) return
  const run = (name: string, fn: () => Promise<number>) => fn()
    .then(n => { if (n) console.log(`[money] ${name}: ${n}`) })
    .catch(err => console.error(`[money] ${name} failed:`, err.message))
  timers = [
    setInterval(() => run('payments reconciled', reconcileRecentCollections), 2 * 60_000),
    setInterval(() => run('withdrawals checked', reconcilePendingPayouts), 5 * 60_000),
    setInterval(() => run('escrows auto-released', autoReleaseEscrows), 30 * 60_000),
    setInterval(() => run('unpaid orders expired', expireUnpaidOrders), 60 * 60_000),
  ]
  timers.forEach(t => t.unref?.())
}

export function stopMoneyJobs() {
  timers.forEach(clearInterval)
  timers = []
}
