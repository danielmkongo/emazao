import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import Escrow from '../models/Escrow'
import Wallet from '../models/Wallet'
import User from '../models/User'
import { nanoid } from 'nanoid'
import { sendNotification } from '../services/notification.service'
import { recordFingerprint } from '../services/risk/rules'

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { sellerId, items, deliveryAddress, notes, deliveryFee = 0 } = req.body

    // Coarse device/network fingerprint, hashed. Lets the self-dealing rule spot
    // one person working both sides of a "sale" without storing anyone's IP.
    void recordFingerprint(req.user!.id, req.ip, req.get('user-agent')).catch(() => {})
    const subtotal = items.reduce((sum: number, item: any) => sum + item.totalPrice, 0)
    const platformFee = parseFloat((subtotal * 0.025).toFixed(2))
    const total = subtotal + deliveryFee + platformFee

    const order = await Order.create({
      orderNumber: `EM-${nanoid(8).toUpperCase()}`,
      buyerId: req.user!.id,
      sellerId,
      items,
      subtotal,
      deliveryFee,
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
    await order.save()

    // Notify buyer when seller ships
    if (status === 'SHIPPED') {
      await sendNotification({
        userId: buyerIdStr,
        type: 'ORDER_SHIPPED',
        title: 'Your order has been shipped',
        body: `Order ${order.orderNumber} is on its way. Confirm delivery when it arrives.`,
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
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    const buyerIdStr = (order.buyerId as any)?._id?.toString() ?? order.buyerId.toString()
    if (buyerIdStr !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Only buyer can confirm delivery' })
    }
    // A second confirm on an already-completed order used to silently re-run:
    // it overwrote deliveredAt with a fresh timestamp and reported success again,
    // even though the escrow mutex below correctly blocked a second wallet
    // credit. That mismatch is exactly the kind of thing that misleads an
    // investigation — the audit trail's "delivered at" no longer matches when
    // delivery was actually confirmed. Terminal/pending-dispute states are
    // rejected outright rather than silently re-completed.
    const nonConfirmable: typeof order.status[] = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED']
    if (nonConfirmable.includes(order.status)) {
      return res.status(409).json({ success: false, message: `Order is already ${order.status.toLowerCase()}` })
    }

    order.status = 'COMPLETED'
    order.deliveredAt = new Date()
    await order.save()

    // Release escrow if exists. The escrow's own HOLDING → RELEASED transition is
    // the mutex here — findOneAndUpdate only succeeds for one caller even if this
    // endpoint, the payment-controller release, and a dispute resolution all race
    // for the same escrow.
    if (order.escrowId) {
      const escrow = await Escrow.findOneAndUpdate(
        { _id: order.escrowId, status: 'HOLDING' },
        { status: 'RELEASED', releasedAt: new Date() },
        { new: true }
      )
      if (escrow) {
        // escrow.amount already includes the buyer-paid platform fee (order.total),
        // so the seller receives everything except that fee — not another cut of it.
        const net = order.total - order.platformFee
        await Wallet.findOneAndUpdate(
          { userId: order.sellerId },
          {
            $inc: { balance: net, pendingBalance: -escrow.amount },
            $push: {
              transactions: {
                type: 'ESCROW_RELEASE',
                amount: net,
                description: `Payment for order ${order.orderNumber}`,
                reference: order._id.toString(),
                status: 'completed',
                createdAt: new Date(),
              },
            },
          },
          { upsert: true, setDefaultsOnInsert: true }
        )
      }
    }

    // Notify seller that payment was released
    await sendNotification({
      userId: order.sellerId.toString(),
      type: 'ESCROW_RELEASED',
      title: 'Payment released to your wallet',
      body: `Order ${order.orderNumber} confirmed. Funds have been added to your wallet.`,
      link: `/wallet`,
      data: { orderId: order._id.toString() },
    })

    res.json({ success: true, data: order })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const disputeOrder = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    const userId = req.user!.id
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)
    if (!isAdmin && order.buyerId.toString() !== userId && order.sellerId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    order.status = 'DISPUTED'
    await order.save()

    if (order.escrowId) {
      await Escrow.findByIdAndUpdate(order.escrowId, { status: 'DISPUTED' })
    }

    res.json({ success: true, data: order })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
