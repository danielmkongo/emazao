import { Request, Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import Checkout from '../models/Checkout'
import User from '../models/User'
import { env } from '../config/env'
import { getPaymentProvider, getCardProvider } from '../services/payments'
import {
  CHECKOUT_PREFIX, REFUND_PREFIX, collectionRef, checkoutRef,
  recordCollection, reconcileCollection, reconcilePayout, returnFailedPayout, releaseEscrow,
} from '../services/money.service'

const payoutRef = (id: string) => `PO${id}`

/** Tanzanian mobile number → 2557XXXXXXXX / 2556XXXXXXXX, or null if it cannot be one. */
export function normaliseTzPhone(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  const local = digits.startsWith('255') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits
  return /^[67]\d{8}$/.test(local) ? `255${local}` : null
}

/**
 * POST /api/payments/collect
 * Sends a USSD push to the buyer's phone. The order only becomes PAYMENT_CONFIRMED
 * once the provider confirms it (webhook or direct lookup) — never on this
 * response, which merely says the prompt was delivered.
 */
export const initiateCollection = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, checkoutId } = req.body
    const phone = normaliseTzPhone(req.body.phoneNumber)
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Enter a Tanzanian mobile money number, e.g. 0712 345 678' })
    }

    const provider = getPaymentProvider()

    // Several sellers, one payment.
    if (checkoutId) {
      if (!mongoose.isValidObjectId(checkoutId)) return res.status(400).json({ success: false, message: 'Invalid checkout' })
      const group = await Checkout.findById(checkoutId)
      if (!group) return res.status(404).json({ success: false, message: 'Checkout not found' })
      if (group.buyerId.toString() !== req.user!.id) return res.status(403).json({ success: false, message: 'Forbidden' })
      if (group.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: `This checkout is already ${group.status.toLowerCase()}` })
      }
      // Every order must still be unpaid, or the grand total would charge for one twice.
      const orders = await Order.find({ _id: { $in: group.orderIds } }).select('status total').lean()
      if (orders.length !== group.orderIds.length || orders.some(o => o.status !== 'PENDING')) {
        return res.status(409).json({
          success: false,
          message: 'Some orders in this checkout are no longer awaiting payment. Pay the remaining orders individually.',
        })
      }
      // Charge what the orders add up to now, in whole shillings.
      const amount = Math.round(orders.reduce((s, o) => s + o.total, 0))

      const result = await provider.initiateCollection({ orderReference: checkoutRef(String(group._id)), amount, currency: group.currency, phoneNumber: phone })
      await Checkout.updateOne({ _id: group._id }, { payerPhone: phone, collectionRequestedAt: new Date() })
      await Order.updateMany({ _id: { $in: group.orderIds } }, { payerPhone: phone, collectionRequestedAt: new Date() })
      return res.json({ success: true, data: { status: result.status, channel: result.channel, providerRef: result.providerRef, amount } })
    }

    if (!mongoose.isValidObjectId(orderId)) return res.status(400).json({ success: false, message: 'Invalid order' })
    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    if (order.buyerId.toString() !== req.user!.id) return res.status(403).json({ success: false, message: 'Forbidden' })
    if (order.status !== 'PENDING') return res.status(400).json({ success: false, message: `Order is ${order.status}, not payable` })
    // Part of a combined checkout that is still open: paying it here and then the
    // checkout as well would take the same money twice.
    if (order.checkoutId) {
      const group = await Checkout.findById(order.checkoutId).select('status').lean()
      if (group?.status === 'PENDING') {
        return res.status(409).json({
          success: false,
          message: 'This order was placed with others from your cart — pay for them together from the checkout.',
          data: { checkoutId: order.checkoutId },
        })
      }
    }

    const amount = Math.round(order.total)
    const result = await provider.initiateCollection({ orderReference: collectionRef(String(order._id)), amount, currency: order.currency, phoneNumber: phone })
    await Order.updateOne({ _id: order._id }, { payerPhone: phone, collectionRequestedAt: new Date() })
    res.json({ success: true, data: { status: result.status, channel: result.channel, providerRef: result.providerRef, amount } })
  } catch (err: any) {
    console.error('[payments] collect failed:', err.message)
    res.status(502).json({ success: false, message: 'The payment service could not send the request. Please try again in a moment.' })
  }
}

/**
 * POST /api/payments/verify — the buyer's payment screen asks while it waits.
 * Checks with the provider directly, so a slow or missing webhook never leaves
 * a paid order looking unpaid.
 */
export const verifyCollection = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, checkoutId } = req.body
    let reference: string
    if (checkoutId) {
      if (!mongoose.isValidObjectId(checkoutId)) return res.status(400).json({ success: false, message: 'Invalid checkout' })
      const group = await Checkout.findById(checkoutId).select('buyerId status')
      if (!group || String(group.buyerId) !== req.user!.id) return res.status(404).json({ success: false, message: 'Checkout not found' })
      if (group.status === 'PAID') return res.json({ success: true, data: { status: 'PAID' } })
      reference = checkoutRef(String(group._id))
    } else {
      if (!mongoose.isValidObjectId(orderId)) return res.status(400).json({ success: false, message: 'Invalid order' })
      const order = await Order.findById(orderId).select('buyerId status checkoutId')
      if (!order || String(order.buyerId) !== req.user!.id) return res.status(404).json({ success: false, message: 'Order not found' })
      if (order.status !== 'PENDING') return res.json({ success: true, data: { status: order.status === 'CANCELLED' ? 'CANCELLED' : 'PAID' } })
      reference = collectionRef(String(order._id))
    }
    const result = await reconcileCollection(reference)
    res.json({ success: true, data: { status: result.status, shortfall: (result as any).shortfall ?? false } })
  } catch (err: any) {
    // The provider being briefly unreachable is not the buyer's problem; keep waiting.
    res.json({ success: true, data: { status: 'PROCESSING' } })
  }
}

/**
 * POST /api/payments/webhook (mounted in app.ts, unauthenticated)
 *
 * A correctly signed callback is acted on directly. An unsigned or unverifiable
 * one is never trusted as-is — but it is not thrown away either: its reference
 * is checked with the provider over our own authenticated connection, and only
 * what the provider confirms is recorded. So payments go through even if the
 * checksum key is missing or mismatched, and a forged callback achieves nothing.
 */
export const paymentWebhook = async (req: Request, res: Response) => {
  const provider = getPaymentProvider()
  const event = provider.verifyAndParseWebhook(req.body)

  try {
    if (!event) {
      const reference = provider.referenceFromWebhook(req.body)
      if (!reference) return res.status(401).json({ success: false, message: 'Invalid webhook' })
      await reconcileReference(reference)
      return res.json({ received: true })
    }

    switch (event.kind) {
      case 'COLLECTION_SUCCEEDED':
        await recordCollection(event.orderReference, { amount: event.amount, currency: event.currency, providerRef: event.providerRef }, provider.name)
        break
      case 'PAYOUT_SUCCEEDED':
        await reconcilePayout(event.orderReference)
        break
      case 'PAYOUT_REVERSED':
        await returnFailedPayout(event.orderReference)
        break
      // COLLECTION_FAILED needs no change: the order stays PENDING and the buyer
      // can retry. UNKNOWN is acknowledged so the provider stops retrying it.
      default:
        break
    }
  } catch (err: any) {
    console.error('[payments] webhook handling failed:', err.message)
  }
  // Always 2xx once handled — a 5xx makes the provider replay an event we recorded.
  res.json({ received: true })
}

/**
 * GET /api/payments/methods — which rails this buyer can actually use.
 *
 * The card button is drawn from this rather than assumed, so an unset Snippe
 * key means the option quietly is not offered instead of a button that fails
 * when someone presses it.
 */
export const cardMethods = async (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { mobileMoney: true, card: Boolean(getCardProvider()) } })
}

/**
 * POST /api/payments/card/checkout — open a hosted card page for an order.
 *
 * Returns a URL to send the buyer to. Everything after that happens on the
 * provider's side; we learn the outcome from the webhook, or by asking.
 */
export const startCardCheckout = async (req: AuthRequest, res: Response) => {
  try {
    const provider = getCardProvider()
    if (!provider?.createCheckout) {
      return res.status(503).json({ success: false, message: 'Card payments are not available yet. Please pay with mobile money.' })
    }

    const { orderId, checkoutId } = req.body
    const buyer = await User.findById(req.user!.id).select('name email phone').lean()
    const customer = { name: buyer?.name, email: buyer?.email, phone: (buyer as any)?.phone }

    // The same guards as mobile money: an order already paid, cancelled or
    // part of an open group checkout must not be chargeable a second time.
    let reference: string
    let amount: number
    let currency: string
    let describe: string
    let save: () => Promise<unknown>

    if (checkoutId) {
      if (!mongoose.isValidObjectId(checkoutId)) return res.status(400).json({ success: false, message: 'Invalid checkout' })
      const group = await Checkout.findById(checkoutId)
      if (!group) return res.status(404).json({ success: false, message: 'Checkout not found' })
      if (String(group.buyerId) !== req.user!.id) return res.status(403).json({ success: false, message: 'Forbidden' })
      if (group.status !== 'PENDING') return res.status(400).json({ success: false, message: `This checkout is already ${group.status.toLowerCase()}` })
      const orders = await Order.find({ _id: { $in: group.orderIds } }).select('status total').lean()
      if (orders.length !== group.orderIds.length || orders.some(o => o.status !== 'PENDING')) {
        return res.status(409).json({ success: false, message: 'Some orders in this checkout are no longer awaiting payment.' })
      }
      reference = checkoutRef(String(group._id))
      amount = Math.round(orders.reduce((sum, o) => sum + o.total, 0))
      currency = group.currency
      describe = `eMazao order group ${String(group._id).slice(-6).toUpperCase()}`
      save = () => Checkout.updateOne({ _id: group._id }, { collectionRequestedAt: new Date() })
    } else {
      if (!mongoose.isValidObjectId(orderId)) return res.status(400).json({ success: false, message: 'Invalid order' })
      const order = await Order.findById(orderId)
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
      if (String(order.buyerId) !== req.user!.id) return res.status(403).json({ success: false, message: 'Forbidden' })
      if (order.status !== 'PENDING') return res.status(400).json({ success: false, message: `Order is ${order.status}, not payable` })
      if (order.checkoutId) {
        const group = await Checkout.findById(order.checkoutId).select('status').lean()
        if (group?.status === 'PENDING') {
          return res.status(409).json({
            success: false,
            message: 'This order was placed with others from your cart — pay for them together from the checkout.',
            data: { checkoutId: order.checkoutId },
          })
        }
      }
      reference = collectionRef(String(order._id))
      amount = Math.round(order.total)
      currency = order.currency
      describe = `eMazao order ${order.orderNumber ?? String(order._id).slice(-6).toUpperCase()}`
      save = () => Order.updateOne({ _id: order._id }, { collectionRequestedAt: new Date() })
    }

    if (!provider.supportedCurrencies.includes(currency)) {
      return res.status(400).json({ success: false, message: `Cards cannot be charged in ${currency} yet.` })
    }

    const session = await provider.createCheckout({
      orderReference: reference,
      amount,
      currency,
      description: describe,
      redirectUrl: `${env.CLIENT_URL}/orders${orderId ? `/${orderId}` : ''}?paid=pending`,
      webhookUrl: `${env.API_URL || env.CLIENT_URL}/api/payments/card/webhook`,
      customer,
      methods: ['card'],
    })

    // Store the provider's reference before answering: if the buyer pays and
    // the webhook is lost, this is the only way back to the payment.
    const target = checkoutId
      ? Checkout.updateOne({ _id: checkoutId }, { cardSessionRef: session.providerRef })
      : Order.updateOne({ _id: orderId }, { cardSessionRef: session.providerRef })
    await target
    await save()

    res.json({ success: true, data: { checkoutUrl: session.checkoutUrl, providerRef: session.providerRef, amount, expiresAt: session.expiresAt } })
  } catch (err: any) {
    console.error('[payments] card checkout failed:', err.message)
    res.status(502).json({ success: false, message: 'Could not open the card payment page. Please try again, or pay with mobile money.' })
  }
}

/**
 * POST /api/payments/card/webhook (mounted in app.ts, unauthenticated)
 *
 * Separate from the mobile-money callback because the two providers prove
 * themselves differently: Snippe signs the raw bytes with a timestamp, which
 * is why app.ts keeps the original buffer. An unverifiable callback is not
 * acted on, but its session is looked up over our own authenticated
 * connection — so a lost signature never loses a payment, and a forged one
 * achieves nothing.
 */
export const cardWebhook = async (req: Request, res: Response) => {
  const provider = getCardProvider()
  if (!provider) return res.status(503).json({ success: false, message: 'Card payments are not configured' })

  const event = provider.verifyAndParseWebhook(req.body, {
    rawBody: (req as any).rawBody,
    headers: req.headers as Record<string, string | string[] | undefined>,
  })

  try {
    if (!event || event.kind === 'UNKNOWN') {
      // Ask the provider what really happened rather than trusting the body.
      const sessionRef = (provider as any).sessionFromWebhook?.(req.body)
      if (sessionRef && provider.queryCollectionByRef) {
        const paid = await provider.queryCollectionByRef(sessionRef)
        if (paid?.status === 'SUCCESS' || paid?.status === 'SETTLED') {
          const owner = await Order.findOne({ cardSessionRef: sessionRef }).select('_id').lean()
            ?? await Checkout.findOne({ cardSessionRef: sessionRef }).select('_id').lean()
          if (owner) {
            const ref = await Checkout.exists({ _id: owner._id })
              ? checkoutRef(String(owner._id))
              : collectionRef(String(owner._id))
            await recordCollection(ref, { amount: paid.amount, currency: paid.currency, providerRef: sessionRef }, provider.name)
          }
        }
      }
      return res.json({ received: true })
    }

    switch (event.kind) {
      case 'COLLECTION_SUCCEEDED':
        await recordCollection(
          event.orderReference,
          { amount: event.amount, currency: event.currency, providerRef: event.providerRef },
          provider.name,
        )
        break
      // A failed card leaves the order PENDING so the buyer can try again,
      // with a card or with mobile money.
      default:
        break
    }
  } catch (err: any) {
    console.error('[payments] card webhook handling failed:', err.message)
  }
  res.json({ received: true })
}

/** Route a bare reference to whichever reconciliation it belongs to. */
async function reconcileReference(reference: string) {
  if (reference.startsWith('PO') || reference.startsWith(REFUND_PREFIX)) return reconcilePayout(reference)
  if (reference.startsWith(CHECKOUT_PREFIX) || mongoose.isValidObjectId(reference)) return reconcileCollection(reference)
}

/**
 * POST /api/payments/escrow/:id/release (admin)
 * Moves escrowed funds onto the seller's withdrawable balance.
 */
export const releaseEscrowByAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ escrowId: req.params.id }).select('_id')
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    const result = await releaseEscrow(String(order._id), 'ADMIN')
    if (!result.released) return res.status(409).json({ success: false, message: result.message })
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export { payoutRef }
