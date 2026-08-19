import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import Escrow from '../models/Escrow'
import Wallet from '../models/Wallet'
import User from '../models/User'
import Product from '../models/Product'
import { nanoid } from 'nanoid'
import { sendNotification } from '../services/notification.service'
import { recordFingerprint } from '../services/risk/rules'

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { items: rawItems, deliveryAddress, notes, deliveryFee } = req.body

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must include at least one item' })
    }
    if (!deliveryAddress?.street || !deliveryAddress?.city || !deliveryAddress?.country) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required' })
    }

    // Re-derive price, seller and product details from the actual Product
    // records — the request only needs to supply productId + quantity.
    // Previously items.unitPrice/totalPrice and the order's sellerId came
    // straight from the client with no server-side check, so a buyer could
    // submit any price they wanted for a real product, or misdirect the
    // order/payout to a seller who never listed it.
    const productIds = [...new Set(rawItems.map((i: any) => String(i?.productId)))]
    const products = await Product.find({ _id: { $in: productIds }, status: 'ACTIVE' })
    const productMap = new Map(products.map(p => [p._id.toString(), p]))

    const items: Array<{ productId: mongoose.Types.ObjectId; title: string; image: string; quantity: number; unit: string; unitPrice: number; totalPrice: number }> = []
    let sellerId: string | null = null
    for (const raw of rawItems) {
      const product = productMap.get(String(raw?.productId))
      if (!product) {
        return res.status(400).json({ success: false, message: 'One of the items in this order is no longer available' })
      }
      const quantity = Number(raw.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: `Invalid quantity for ${product.title}` })
      }
      if (product.minimumOrder && quantity < product.minimumOrder) {
        return res.status(400).json({ success: false, message: `${product.title} requires a minimum order of ${product.minimumOrder} ${product.stockUnit ?? ''}` })
      }
      if (sellerId === null) sellerId = product.sellerId.toString()
      else if (sellerId !== product.sellerId.toString()) {
        return res.status(400).json({ success: false, message: 'All items in one order must be from the same seller' })
      }
      items.push({
        productId: product._id,
        title: product.title,
        image: product.images[0] ?? '',
        quantity,
        unit: product.stockUnit ?? product.priceUnit,
        unitPrice: product.price,
        totalPrice: parseFloat((product.price * quantity).toFixed(2)),
      })
    }

    // Coarse device/network fingerprint, hashed. Lets the self-dealing rule spot
    // one person working both sides of a "sale" without storing anyone's IP.
    void recordFingerprint(req.user!.id, req.ip, req.get('user-agent')).catch(() => {})
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
    const safeDeliveryFee = Math.max(0, Number(deliveryFee) || 0)
    const platformFee = parseFloat((subtotal * 0.025).toFixed(2))
    const total = subtotal + safeDeliveryFee + platformFee

    const order = await Order.create({
      orderNumber: `EM-${nanoid(8).toUpperCase()}`,
      buyerId: req.user!.id,
      sellerId: sellerId!, // guaranteed set — the items loop above ran at least once
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
      userId: sellerId!, // guaranteed set — the items loop above ran at least once
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
