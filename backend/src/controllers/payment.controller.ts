import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import Escrow from '../models/Escrow'
import Wallet from '../models/Wallet'
import User from '../models/User'
import { getPaymentProvider } from '../services/payments'
import { sendNotification } from '../services/notification.service'
import { screenOrder } from '../services/risk/rules'
import { TIER_POLICIES } from '../services/verification/tiers'

// ClickPesa requires an alphanumeric, blank-free reference and hands it back on
// the webhook, so the order's own id doubles as the correlation key. Payouts need
// their own distinct reference, hence the prefix.
const collectionRef = (orderId: string) => orderId
const payoutRef = (id: string) => `PO${id}`

/**
 * POST /api/payments/collect
 * Sends a USSD push to the buyer's phone. The order only becomes PAYMENT_CONFIRMED
 * when the provider's webhook confirms it — never on this response, which merely
 * says the prompt was delivered.
 */
export const initiateCollection = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, phoneNumber } = req.body
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Mobile money phone number is required' })
    }

    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    if (order.buyerId.toString() !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Order is ${order.status}, not payable` })
    }

    const provider = getPaymentProvider()
    const result = await provider.initiateCollection({
      orderReference: collectionRef(order._id!.toString()),
      amount: order.total,
      currency: order.currency,
      phoneNumber,
    })

    res.json({
      success: true,
      data: { status: result.status, channel: result.channel, providerRef: result.providerRef },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/payments/webhook (mounted in app.ts, unauthenticated)
 * Authenticity is established by the provider's checksum, not by a session.
 */
export const paymentWebhook = async (req: Request, res: Response) => {
  const provider = getPaymentProvider()
  const event = provider.verifyAndParseWebhook(req.body)

  if (!event) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature' })
  }

  try {
    switch (event.kind) {
      case 'COLLECTION_SUCCEEDED':
        await onCollectionSucceeded(event.orderReference, event.providerRef, provider.name)
        break
      case 'PAYOUT_REVERSED':
        await onPayoutReversed(event.orderReference)
        break
      // COLLECTION_FAILED needs no state change: the order stays PENDING and the
      // buyer can simply retry. UNKNOWN is acknowledged so the provider stops
      // retrying an event we have no handler for.
      default:
        break
    }
  } catch (err: any) {
    console.error('[payments] webhook handling failed:', err.message)
  }

  // Always 2xx once the signature is valid — a 5xx here makes the provider replay
  // an event we already recorded.
  res.json({ received: true })
}

async function onCollectionSucceeded(orderReference: string, providerRef: string, providerName: string) {
  const order = await Order.findById(orderReference)
  // Only PENDING → PAYMENT_CONFIRMED, so a replayed webhook is a no-op rather
  // than a second escrow row and a second credit to the seller.
  if (!order || order.status !== 'PENDING') return

  order.status = 'PAYMENT_CONFIRMED'
  await order.save()

  const escrow = await Escrow.create({
    orderId: order._id,
    amount: order.total,
    currency: order.currency,
    status: 'HOLDING',
    provider: providerName,
    providerRef,
  })

  order.escrowId = escrow._id as any
  await order.save()

  await Wallet.findOneAndUpdate(
    { userId: order.sellerId },
    {
      $inc: { pendingBalance: order.total },
      $setOnInsert: { balance: 0, currency: order.currency },
      $push: {
        transactions: {
          type: 'ESCROW_HOLD',
          amount: order.total,
          description: `Payment held in escrow for order ${order.orderNumber}`,
          reference: order._id!.toString(),
          status: 'pending',
          createdAt: new Date(),
        },
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  )

  await sendNotification({
    userId: order.sellerId.toString(),
    type: 'NEW_ORDER',
    title: 'Payment received — order confirmed',
    body: `Buyer paid for order ${order.orderNumber}. Prepare for shipment.`,
    link: `/orders/${order._id}`,
    data: { orderId: order._id!.toString() },
  })

  // Screen for laundering patterns now that real money has moved. Deliberately
  // not awaited: monitoring must never delay or fail a confirmed payment, and
  // the funds sit in escrow regardless, so there is time to act on a flag.
  void screenOrder(order._id!.toString(), TIER_POLICIES[1].payoutCeiling)
}

/**
 * A payout the provider later reversed (bad number, wallet limit, dispute). The
 * money never reached the seller, so put it back on their balance and tell them —
 * otherwise it silently vanishes from both the wallet and their phone.
 */
async function onPayoutReversed(reference: string) {
  const walletUserId = reference.startsWith('PO') ? reference.slice(2) : reference
  const wallet = await Wallet.findOne({ 'transactions.reference': reference })
  if (!wallet) return

  const txn = wallet.transactions.find(t => t.reference === reference)
  if (!txn || txn.status === 'reversed') return

  txn.status = 'reversed'
  wallet.balance += txn.amount
  wallet.transactions.push({
    type: 'REFUND',
    amount: txn.amount,
    description: 'Withdrawal reversed by payment provider — funds returned to your balance',
    reference,
    status: 'completed',
    createdAt: new Date(),
  })
  await wallet.save()

  await sendNotification({
    userId: wallet.userId.toString(),
    type: 'PAYOUT_REVERSED',
    title: 'Withdrawal failed',
    body: 'Your withdrawal could not be delivered and has been returned to your wallet balance.',
    link: '/wallet',
    data: { userId: walletUserId },
  })
}

/**
 * POST /api/payments/escrow/:id/release (admin)
 * Moves escrowed funds onto the seller's withdrawable balance. The seller then
 * cashes out via /api/wallet/withdraw, which is what actually pushes money to
 * their phone.
 */
export const releaseEscrow = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ escrowId: req.params.id })
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    // The escrow's own HOLDING → RELEASED transition is the mutex — this only
    // succeeds for one caller even if a buyer's confirmDelivery, a dispute
    // resolution, and this admin-triggered release all race for the same escrow.
    const escrow = await Escrow.findOneAndUpdate(
      { _id: req.params.id, status: 'HOLDING' },
      { status: 'RELEASED', releasedAt: new Date() },
      { new: true },
    )
    if (!escrow) return res.status(409).json({ success: false, message: 'Escrow already processed or not found' })

    order.status = 'COMPLETED'
    await order.save()

    // escrow.amount already includes the buyer-paid platform fee (order.total),
    // so the seller receives everything except that fee, not another cut of it.
    const net = order.total - order.platformFee
    await Wallet.findOneAndUpdate(
      { userId: order.sellerId },
      {
        $inc: { balance: net, pendingBalance: -escrow.amount },
        $push: {
          transactions: {
            type: 'ESCROW_RELEASE',
            amount: net,
            description: `Payment released for order ${order.orderNumber}`,
            reference: order._id!.toString(),
            status: 'completed',
            createdAt: new Date(),
          },
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    )

    const seller = await User.findById(order.sellerId).select('currency')
    await sendNotification({
      userId: order.sellerId.toString(),
      type: 'ESCROW_RELEASED',
      title: 'Payment released to your wallet',
      body: `Order ${order.orderNumber} funds released. ${seller?.currency ?? order.currency} ${net.toLocaleString()} added to your wallet.`,
      link: '/wallet',
      data: { orderId: order._id.toString() },
    })

    res.json({ success: true, data: escrow })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export { payoutRef }
