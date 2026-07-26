import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import Escrow from '../models/Escrow'
import Wallet from '../models/Wallet'
import stripe from '../config/stripe'
import { env } from '../config/env'
import { sendNotification } from '../services/notification.service'

export const createPaymentIntent = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.body
    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    if (order.buyerId.toString() !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Order is ${order.status}, not payable` })
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(order.total * 100),
        currency: order.currency.toLowerCase(),
        metadata: { orderId: order._id!.toString(), buyerId: req.user!.id },
      },
      // Re-opening the pay screen or a retried request reuses the same intent
      // instead of creating a duplicate charge attempt for the same order.
      { idempotencyKey: `pi_order_${order._id}` }
    )

    res.json({ success: true, data: { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  let event: any

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object
    const orderId = pi.metadata?.orderId

    if (orderId) {
      const order = await Order.findById(orderId)
      if (order && order.status === 'PENDING') {
        order.status = 'PAYMENT_CONFIRMED'
        await order.save()

        const escrow = await Escrow.create({
          orderId: order._id,
          amount: order.total,
          currency: order.currency,
          status: 'HOLDING',
          stripePaymentIntentId: pi.id,
        })

        order.escrowId = escrow._id as any
        await order.save()

        // Add to seller's pending balance
        let wallet = await Wallet.findOne({ userId: order.sellerId })
        if (!wallet) {
          wallet = await Wallet.create({ userId: order.sellerId, balance: 0, pendingBalance: 0, currency: order.currency })
        }
        wallet.pendingBalance += order.total
        wallet.transactions.push({
          type: 'ESCROW_HOLD',
          amount: order.total,
          description: `Payment held in escrow for order ${order.orderNumber}`,
          reference: order._id!.toString(),
          status: 'pending',
          createdAt: new Date(),
        })
        await wallet.save()

        await sendNotification({
          userId: order.sellerId.toString(),
          type: 'NEW_ORDER',
          title: 'Payment received — order confirmed',
          body: `Buyer paid for order ${order.orderNumber}. Prepare for shipment.`,
          link: `/orders/${order._id}`,
          data: { orderId: order._id!.toString() },
        })
      }
    }
  }

  res.json({ received: true })
}

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
      { new: true }
    )
    if (!escrow) return res.status(409).json({ success: false, message: 'Escrow already processed or not found' })

    order.status = 'COMPLETED'
    await order.save()

    // Credit seller wallet — escrow.amount already includes the buyer-paid
    // platform fee (order.total), so the seller receives everything except that
    // fee, not another cut of it.
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
      { upsert: true, setDefaultsOnInsert: true }
    )

    await sendNotification({
      userId: order.sellerId.toString(),
      type: 'ESCROW_RELEASED',
      title: 'Payment released to your wallet',
      body: `Order ${order.orderNumber} funds released. $${net.toFixed(2)} added to your wallet.`,
      link: '/wallet',
      data: { orderId: order._id.toString() },
    })

    res.json({ success: true, data: escrow })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
