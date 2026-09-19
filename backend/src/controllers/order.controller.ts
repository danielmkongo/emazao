import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import Escrow from '../models/Escrow'
import { releaseEscrow } from '../services/money.service'
import Dispute from '../models/Dispute'
import Wallet from '../models/Wallet'
import User from '../models/User'
import Product from '../models/Product'
import { newOrderNumber } from '../utils/orderNumber'
import { sendNotification } from '../services/notification.service'
import { recordFingerprint } from '../services/risk/rules'
import { priceItems, orderTotals } from '../services/orderPricing'

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { items: rawItems, deliveryAddress, notes, deliveryFee } = req.body

    if (!deliveryAddress?.street || !deliveryAddress?.city || !deliveryAddress?.country) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required' })
    }

    // Price, seller and product details come from the real Product records; the
    // request only supplies productId + quantity. See services/orderPricing.
    const priced = await priceItems(rawItems)
    if (!priced.ok) return res.status(400).json({ success: false, message: priced.message })

    // A single order has a single seller: escrow, dispatch, tracking and payout
    // are all per-seller. Buying from several sellers at once goes through the
    // cart, which splits it into one order each.
    const sellerIds = new Set(priced.items.map(i => i.sellerId))
    if (sellerIds.size > 1) {
      return res.status(400).json({ success: false, message: 'All items in one order must be from the same seller' })
    }
    const sellerId = priced.items[0]!.sellerId
    const items = priced.items.map(({ sellerId: _s, ...item }) => item)

    // Coarse device/network fingerprint, hashed. Lets the self-dealing rule spot
    // one person working both sides of a "sale" without storing anyone's IP.
    void recordFingerprint(req.user!.id, req.ip, req.get('user-agent')).catch(() => {})
    const { subtotal, deliveryFee: safeDeliveryFee, platformFee, total } = orderTotals(priced.items, deliveryFee)

    const order = await Order.create({
      orderNumber: newOrderNumber(),
      buyerId: req.user!.id,
      sellerId,
      items,
      subtotal,
      deliveryFee: safeDeliveryFee,
      platformFee,
      total,
      currency: 'TZS',
      deliveryAddress,
      notes,
      status: 'PENDING',
    })

    // Notify the seller
    const buyer = await User.findById(req.user!.id).select('name')
    await sendNotification({
      userId: sellerId,
      type: 'NEW_ORDER',
      title: 'New order received',
      body: `${buyer?.name ?? 'A buyer'} placed order ${order.orderNumber}`,
      link: `/orders/${order._id}`,
      data: { orderId: order._id.toString() },
    })

    res.status(201).json({ success: true, data: order })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const role = req.user!.role
    const query = role === 'FARMER' ? { sellerId: userId } : { buyerId: userId }
    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(50)
    res.json({ success: true, data: orders })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getOrder = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('buyerId', 'name username avatar')
      .populate('sellerId', 'name username avatar')
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    const userId = req.user!.id
    const buyerIdStr = (order.buyerId as any)?._id?.toString() ?? order.buyerId.toString()
    const sellerIdStr = (order.sellerId as any)?._id?.toString() ?? order.sellerId.toString()
    if (buyerIdStr !== userId && sellerIdStr !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    res.json({ success: true, data: order })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    const userId = req.user!.id
    const role = req.user!.role
    const sellerIdStr = order.sellerId.toString()
    const buyerIdStr = order.buyerId.toString()
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role)
    const isSeller = sellerIdStr === userId
    const isBuyer = buyerIdStr === userId

    // Only seller can mark SHIPPED (and only from a paid state); buyers can only
    // cancel a still-unpaid order — everything else (confirming payment, marking
    // delivered/completed) goes through the dedicated payment-webhook/confirmDelivery
    // flows, never this generic status endpoint.
    if (!isAdmin && !isSeller && !isBuyer) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    if (!isAdmin && isSeller) {
      if (status !== 'SHIPPED') {
        return res.status(403).json({ success: false, message: 'Sellers can only mark orders as SHIPPED' })
      }
      if (!['PAYMENT_CONFIRMED', 'PROCESSING'].includes(order.status)) {
        return res.status(400).json({ success: false, message: `Cannot ship an order that is ${order.status}` })
      }
    }
    if (!isAdmin && isBuyer && !(status === 'CANCELLED' && order.status === 'PENDING')) {
      return res.status(403).json({ success: false, message: 'Buyers can only cancel a pending order' })
    }

    order.status = status
    if (status === 'DELIVERED') order.deliveredAt = new Date()
    // Starts the clock for automatic release to the seller.
    if (status === 'SHIPPED' && !order.shippedAt) order.shippedAt = new Date()
    await order.save()

    // Notify buyer when seller ships
    if (status === 'SHIPPED') {
      await sendNotification({
        userId: buyerIdStr,
        type: 'ORDER_SHIPPED',
        title: 'Your order has been shipped',
        body: `Order ${order.orderNumber} is on its way. Confirm delivery when it arrives, or report a problem — otherwise the seller is paid automatically after 7 days.`,
        link: `/orders/${order._id}`,
        data: { orderId: order._id.toString() },
      })
    }

    res.json({ success: true, data: order })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const confirmDelivery = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id).select('buyerId status escrowId')
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    if (String(order.buyerId) !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Only the buyer can confirm delivery' })
    }
    // Only a paid order that is on its way (or arrived) can be confirmed. An
    // unpaid order used to be confirmable, marking it complete with no money
    // ever having changed hands.
    if (!['PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
      return res.status(409).json({ success: false, message: `This order is ${order.status.toLowerCase().replace('_', ' ')} and cannot be confirmed` })
    }
    const result = await releaseEscrow(String(order._id), 'BUYER_CONFIRMED')
    if (!result.released) return res.status(409).json({ success: false, message: result.message })
    const updated = await Order.findById(order._id)
    res.json({ success: true, data: updated })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

const DISPUTE_REASONS = ['NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'DAMAGED', 'WRONG_QUANTITY', 'OTHER'] as const

/**
 * POST /api/orders/:id/dispute — report a problem with a paid order.
 *
 * Freezes the payment (escrow HOLDING → DISPUTED) so it can be neither released
 * automatically nor withdrawn, and opens a Dispute for eMazao to review. This
 * used to flip statuses without ever creating the Dispute, so the admin queue
 * stayed empty and the money sat frozen with nobody told.
 */
export const disputeOrder = async (req: AuthRequest, res: Response) => {
  try {
    const reason = String(req.body?.reason ?? '')
    const description = String(req.body?.description ?? '').trim()
    if (!DISPUTE_REASONS.includes(reason as any)) return res.status(400).json({ success: false, message: 'Choose what went wrong' })
    if (description.length < 10) return res.status(400).json({ success: false, message: 'Describe the problem in a sentence or two' })
    if (description.length > 2000) return res.status(400).json({ success: false, message: 'Please keep the description under 2000 characters' })

    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    const userId = req.user!.id
    if (String(order.buyerId) !== userId && String(order.sellerId) !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    // Only while the money is still held: after release or refund there is
    // nothing left to freeze.
    if (!['PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status) || !order.escrowId) {
      return res.status(409).json({ success: false, message: 'Problems can be reported while the payment is still held' })
    }
    const escrow = await Escrow.findOneAndUpdate({ _id: order.escrowId, status: 'HOLDING' }, { status: 'DISPUTED' }, { new: true })
    if (!escrow) return res.status(409).json({ success: false, message: 'This payment has already been released or is under review' })

    order.status = 'DISPUTED'
    order.trackingEvents = [...(order.trackingEvents ?? []), { status: 'DISPUTED', note: 'Problem reported — payment on hold while eMazao reviews', at: new Date() }]
    await order.save()
    const dispute = await Dispute.create({ orderId: order._id, raisedById: userId, reason, description, evidence: [] })

    const otherParty = String(order.buyerId) === userId ? order.sellerId : order.buyerId
    await sendNotification({
      userId: String(otherParty), type: 'ORDER',
      title: 'A problem was reported with an order',
      body: `Order ${order.orderNumber} is on hold while eMazao reviews it. We will be in touch.`,
      link: `/orders/${order._id}`, data: { orderId: String(order._id) },
    }).catch(() => {})

    res.json({ success: true, data: { order, dispute } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
