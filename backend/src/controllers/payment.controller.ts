import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import Escrow from '../models/Escrow'
import Wallet from '../models/Wallet'
import stripe from '../config/stripe'
import { env } from '../config/env'

export const createPaymentIntent = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.body
    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    if (order.buyerId.toString() !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100),
      currency: order.currency.toLowerCase(),
      metadata: { orderId: order._id!.toString(), buyerId: req.user!.id },
    })

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
        await wallet.save()
      }
    }
  }

  res.json({ received: true })
}

export const releaseEscrow = async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await Escrow.findById(req.params.id)
    if (!escrow) return res.status(404).json({ success: false, message: 'Escrow not found' })
    if (escrow.status !== 'HOLDING') {
      return res.status(400).json({ success: false, message: `Escrow is ${escrow.status}, cannot release` })
    }

    const order = await Order.findById(escrow.orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    escrow.status = 'RELEASED'
    escrow.releasedAt = new Date()
    await escrow.save()

    order.status = 'COMPLETED'
    await order.save()

    // Credit seller wallet
    const net = escrow.amount * 0.975
    let wallet = await Wallet.findOne({ userId: order.sellerId })
    if (!wallet) {
      wallet = await Wallet.create({ userId: order.sellerId, balance: 0, pendingBalance: 0, currency: escrow.currency })
    }
    wallet.balance += net
    wallet.pendingBalance = Math.max(0, wallet.pendingBalance - escrow.amount)
    await wallet.save()

    res.json({ success: true, data: escrow })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
