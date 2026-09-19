/**
 * Every movement of real money goes through here: confirming a buyer paid,
 * releasing escrow to a seller, refunding a buyer, and reconciling with the
 * payment provider. One implementation, so the webhook, the buyer's "confirm
 * delivery", an admin's decision and the background jobs can never disagree
 * about what a transition means or do it twice.
 *
 * Each transition is a single conditional update on the record's current
 * status (PENDING → PAYMENT_CONFIRMED, HOLDING → RELEASED, …). Whoever gets
 * there first wins; everyone else finds nothing to update. That is what makes
 * a replayed webhook, a double tap and a racing background job harmless.
 */
import Order from '../models/Order'
import Checkout from '../models/Checkout'
import Escrow from '../models/Escrow'
import Wallet from '../models/Wallet'
import { getPaymentProvider } from './payments'
import { sendNotification } from './notification.service'
import { screenOrder } from './risk/rules'
import { TIER_POLICIES } from './verification/tiers'

export const CHECKOUT_PREFIX = 'CO'
export const REFUND_PREFIX = 'RF'
export const collectionRef = (orderId: string) => orderId
export const checkoutRef = (checkoutId: string) => `${CHECKOUT_PREFIX}${checkoutId}`
export const refundRef = (orderId: string) => `${REFUND_PREFIX}${orderId}`

/** Days after dispatch before a seller is paid automatically, absent a dispute. */
export const AUTO_RELEASE_DAYS = 7

/** Whole shillings: mobile money cannot move fractions. Allows a shilling of rounding. */
const AMOUNT_TOLERANCE = 1

// ─── Paid ───────────────────────────────────────────────────────────────────

/**
 * The provider says a collection succeeded. Confirm what it paid for, after
 * checking the money that arrived covers it. A short or wrong-currency payment
 * is never accepted as payment in full.
 */
export async function recordCollection(reference: string, paid: { amount: number; currency: string; providerRef: string }, providerName: string) {
  if (reference.startsWith(CHECKOUT_PREFIX)) {
    const checkoutId = reference.slice(CHECKOUT_PREFIX.length)
    const group = await Checkout.findById(checkoutId)
    if (!group || group.status !== 'PENDING') return { confirmed: 0 }
    const orders = await Order.find({ _id: { $in: group.orderIds } }).select('total status currency')
    const expected = orders.filter(o => o.status === 'PENDING').reduce((s, o) => s + o.total, 0)
    if (!coversAmount(paid, expected, group.currency)) {
      console.error(`[money] checkout ${checkoutId}: paid ${paid.amount} ${paid.currency}, expected ${expected} ${group.currency} — not confirmed`)
      return { confirmed: 0, shortfall: true }
    }
    const claimed = await Checkout.findOneAndUpdate(
      { _id: checkoutId, status: 'PENDING' },
      { status: 'PAID', providerRef: paid.providerRef, paidAt: new Date() },
      { new: true },
    )
    if (!claimed) return { confirmed: 0 }
    let confirmed = 0
    for (const id of claimed.orderIds) {
      if (await confirmOrderPaid(String(id), paid.providerRef, providerName)) confirmed++
    }
    return { confirmed }
  }

  const order = await Order.findById(reference).select('total currency status')
  if (!order || order.status !== 'PENDING') return { confirmed: 0 }
  if (!coversAmount(paid, order.total, order.currency)) {
    console.error(`[money] order ${reference}: paid ${paid.amount} ${paid.currency}, expected ${order.total} ${order.currency} — not confirmed`)
    return { confirmed: 0, shortfall: true }
  }
  return { confirmed: (await confirmOrderPaid(reference, paid.providerRef, providerName)) ? 1 : 0 }
}

function coversAmount(paid: { amount: number; currency: string }, expected: number, currency: string) {
  if (paid.currency && currency && paid.currency.toUpperCase() !== currency.toUpperCase()) return false
  return paid.amount + AMOUNT_TOLERANCE >= Math.round(expected)
}

/** PENDING → PAYMENT_CONFIRMED, open the escrow, tell the seller. At most once. */
async function confirmOrderPaid(orderId: string, providerRef: string, providerName: string): Promise<boolean> {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: 'PENDING' },
    { status: 'PAYMENT_CONFIRMED' },
    { new: true },
  )
  if (!order) return false

  // The escrow's unique orderId index makes this safe even in a race that
  // somehow slipped past the status guard.
  const escrow = await Escrow.findOneAndUpdate(
    { orderId: order._id },
    { $setOnInsert: { orderId: order._id, amount: order.total, currency: order.currency, status: 'HOLDING', provider: providerName, providerRef } },
    { upsert: true, new: true },
  )
  order.escrowId = escrow._id as any
  order.trackingEvents = [...(order.trackingEvents ?? []), { status: 'PAYMENT_CONFIRMED', note: 'Payment received and held securely', at: new Date() }]
  await order.save()

  await Wallet.findOneAndUpdate(
    { userId: order.sellerId },
    {
      $inc: { pendingBalance: order.total },
      $setOnInsert: { balance: 0, currency: order.currency },
      $push: { transactions: { type: 'ESCROW_HOLD', amount: order.total, description: `Payment held in escrow for order ${order.orderNumber}`, reference: String(order._id), status: 'pending', createdAt: new Date() } },
    },
    { upsert: true, setDefaultsOnInsert: true },
  )

  await Promise.all([
    sendNotification({
      userId: String(order.sellerId), type: 'NEW_ORDER',
      title: 'Payment received — order confirmed',
      body: `The buyer paid for order ${order.orderNumber}. Prepare it for dispatch.`,
      link: `/orders/${order._id}`, data: { orderId: String(order._id) },
    }),
    sendNotification({
      userId: String(order.buyerId), type: 'PAYMENT',
      title: 'Payment confirmed',
      body: `We received your payment for order ${order.orderNumber}. It is held safely until you confirm delivery.`,
      link: `/orders/${order._id}`, data: { orderId: String(order._id) },
    }),
  ]).catch(e => console.error('[money] notify failed:', e.message))

  // Laundering screen now that real money has moved. Not awaited: monitoring
  // must never delay or fail a confirmed payment.
  void screenOrder(String(order._id), TIER_POLICIES[1].payoutCeiling)
  return true
}

// ─── Release ────────────────────────────────────────────────────────────────

/**
 * Escrow → seller's withdrawable balance, minus the platform fee the buyer
 * paid. `from` is the escrow state this caller is entitled to release from:
 * HOLDING normally, DISPUTED when an admin rules for the seller.
 */
export async function releaseEscrow(orderId: string, reason: 'BUYER_CONFIRMED' | 'AUTO' | 'ADMIN' | 'DISPUTE', from: 'HOLDING' | 'DISPUTED' = 'HOLDING') {
  const order = await Order.findById(orderId)
  if (!order?.escrowId) return { released: false, message: 'No payment is held for this order' }

  const escrow = await Escrow.findOneAndUpdate(
    { _id: order.escrowId, status: from },
    { status: 'RELEASED', releasedAt: new Date(), releaseReason: reason },
    { new: true },
  )
  if (!escrow) return { released: false, message: 'This payment was already released or refunded' }

  const now = new Date()
  const note = reason === 'AUTO' ? `Released automatically ${AUTO_RELEASE_DAYS} days after dispatch`
    : reason === 'DISPUTE' ? 'Released to the seller after review'
    : reason === 'ADMIN' ? 'Released by eMazao' : 'Buyer confirmed delivery'
  await Order.updateOne({ _id: order._id }, {
    status: 'COMPLETED',
    ...(order.deliveredAt ? {} : { deliveredAt: now }),
    $push: { trackingEvents: { status: 'COMPLETED', note, at: now } },
  })

  const net = Math.max(0, order.total - order.platformFee)
  await Wallet.findOneAndUpdate(
    { userId: order.sellerId },
    {
      $inc: { balance: net, pendingBalance: -escrow.amount },
      $setOnInsert: { currency: order.currency },
      $push: { transactions: { type: 'ESCROW_RELEASE', amount: net, description: `Payment for order ${order.orderNumber}`, reference: String(order._id), status: 'completed', createdAt: now } },
    },
    { upsert: true, setDefaultsOnInsert: true },
  )

  await sendNotification({
    userId: String(order.sellerId), type: 'ESCROW_RELEASED',
    title: 'Payment released to your wallet',
    body: `${order.currency} ${net.toLocaleString()} for order ${order.orderNumber} is now in your wallet.`,
    link: '/wallet', data: { orderId: String(order._id) },
  }).catch(() => {})
  return { released: true, net }
}

// ─── Refund ─────────────────────────────────────────────────────────────────

/**
 * Give the buyer their money back: a real payout to the same mobile-money
 * wallet that paid. The escrow is claimed first, so it can never be both
 * refunded and released. If the payout itself fails, the escrow records it and
 * an admin can retry; the money has not gone anywhere.
 */
export async function refundBuyer(orderId: string, from: 'HOLDING' | 'DISPUTED' = 'DISPUTED') {
  const order = await Order.findById(orderId).select('+payerPhone')
  if (!order?.escrowId) return { refunded: false, message: 'No payment is held for this order' }

  const escrow = await Escrow.findOneAndUpdate(
    { _id: order.escrowId, status: from },
    { status: 'REFUNDED', refundedAt: new Date(), refundRef: refundRef(String(order._id)), refundStatus: 'PENDING' },
    { new: true },
  )
  if (!escrow) return { refunded: false, message: 'This payment was already released or refunded' }

  await Order.updateOne({ _id: order._id }, {
    status: 'REFUNDED',
    $push: { trackingEvents: { status: 'REFUNDED', note: 'Payment returned to the buyer', at: new Date() } },
  })
  // The seller was only ever holding this as pending; it leaves their totals.
  await Wallet.updateOne(
    { userId: order.sellerId },
    { $inc: { pendingBalance: -escrow.amount }, $push: { transactions: { type: 'REFUND', amount: escrow.amount, description: `Order ${order.orderNumber} refunded to the buyer`, reference: String(order._id), status: 'completed', createdAt: new Date() } } },
  )

  const payout = await sendRefund(String(escrow._id))
  await Promise.all([
    sendNotification({
      userId: String(order.buyerId), type: 'PAYMENT',
      title: payout.sent ? 'Refund on its way' : 'Refund being processed',
      body: payout.sent
        ? `${order.currency} ${Math.floor(escrow.amount).toLocaleString()} for order ${order.orderNumber} is being sent back to your mobile money.`
        : `Your refund for order ${order.orderNumber} is approved and being processed. We will let you know when it is sent.`,
      link: `/orders/${order._id}`, data: { orderId: String(order._id) },
    }),
    sendNotification({
      userId: String(order.sellerId), type: 'ORDER',
      title: 'Order refunded',
      body: `Order ${order.orderNumber} was refunded to the buyer after review.`,
      link: `/orders/${order._id}`, data: { orderId: String(order._id) },
    }),
  ]).catch(() => {})
  return { refunded: true, sent: payout.sent, message: payout.error }
}

/** Push (or re-push) a refund payout for an escrow already marked REFUNDED. */
export async function sendRefund(escrowId: string): Promise<{ sent: boolean; error?: string }> {
  const escrow = await Escrow.findById(escrowId)
  if (!escrow || escrow.status !== 'REFUNDED' || escrow.refundStatus === 'SENT') return { sent: escrow?.refundStatus === 'SENT' }
  const order = await Order.findById(escrow.orderId).select('+payerPhone')
  let phone = order?.payerPhone
  if (!phone && order?.checkoutId) phone = (await Checkout.findById(order.checkoutId).select('+payerPhone'))?.payerPhone
  if (!phone) {
    await Escrow.updateOne({ _id: escrow._id }, { refundStatus: 'FAILED', refundError: 'No paying phone number on record — refund manually' })
    return { sent: false, error: 'No paying phone number on record' }
  }
  try {
    const result = await getPaymentProvider().createPayout({
      orderReference: escrow.refundRef ?? refundRef(String(escrow.orderId)),
      amount: escrow.amount,
      currency: escrow.currency,
      phoneNumber: phone,
    })
    await Escrow.updateOne({ _id: escrow._id }, { refundStatus: result.status === 'FAILED' ? 'FAILED' : 'SENT', refundError: undefined })
    return { sent: result.status !== 'FAILED' }
  } catch (err: any) {
    await Escrow.updateOne({ _id: escrow._id }, { refundStatus: 'FAILED', refundError: String(err.message).slice(0, 300) })
    return { sent: false, error: err.message }
  }
}

// ─── Reconcile ──────────────────────────────────────────────────────────────

/**
 * Ask the provider whether a reference was paid, and act on its answer. Used
 * when a webhook is missing, late or unverifiable, and while the buyer waits
 * on the payment screen. The answer comes over our own authenticated
 * connection to the provider, so it cannot be forged.
 */
export async function reconcileCollection(reference: string) {
  const provider = getPaymentProvider()
  const lookup = await provider.queryCollection(reference)
  if (!lookup) return { status: 'UNKNOWN' as const, confirmed: 0 }
  if (lookup.status === 'SUCCESS' || lookup.status === 'SETTLED') {
    const r = await recordCollection(reference, { amount: lookup.amount, currency: lookup.currency, providerRef: lookup.providerRef ?? reference }, provider.name)
    return { status: 'PAID' as const, ...r }
  }
  return { status: lookup.status === 'FAILED' ? 'FAILED' as const : 'PROCESSING' as const, confirmed: 0 }
}

/** Settle a withdrawal the provider has since finished or given back. */
export async function reconcilePayout(reference: string) {
  const lookup = await getPaymentProvider().queryPayout(reference)
  if (!lookup) return
  if (lookup.status === 'SUCCESS') {
    await Wallet.updateOne({ 'transactions.reference': reference, 'transactions.status': 'pending' }, { $set: { 'transactions.$.status': 'completed' } })
  } else if (lookup.status === 'FAILED' || lookup.status === 'REVERSED') {
    await returnFailedPayout(reference)
  }
}

/**
 * A withdrawal that never reached the seller goes back on their balance.
 * Guarded on the transaction's own status so it is credited back only once.
 */
export async function returnFailedPayout(reference: string) {
  const wallet = await Wallet.findOne({ 'transactions.reference': reference, 'transactions.type': 'WITHDRAWAL' })
  const txn = wallet?.transactions.find(t => t.reference === reference && t.type === 'WITHDRAWAL')
  if (!wallet || !txn || txn.status === 'reversed' || txn.status === 'failed') return
  const res = await Wallet.updateOne(
    { _id: wallet._id, transactions: { $elemMatch: { reference, type: 'WITHDRAWAL', status: { $in: ['pending', 'completed'] } } } },
    {
      $inc: { balance: txn.amount },
      $set: { 'transactions.$.status': 'reversed' },
    },
  )
  if (!res.modifiedCount) return
  await Wallet.updateOne({ _id: wallet._id }, { $push: { transactions: { type: 'REFUND', amount: txn.amount, description: 'Withdrawal could not be delivered — returned to your balance', reference, status: 'completed', createdAt: new Date() } } })
  await sendNotification({
    userId: String(wallet.userId), type: 'PAYOUT_REVERSED',
    title: 'Withdrawal returned',
    body: 'Your withdrawal could not be delivered and the money is back in your wallet.',
    link: '/wallet',
  }).catch(() => {})
}
