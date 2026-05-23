import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import Escrow from '../models/Escrow'
import Wallet from '../models/Wallet'
import User from '../models/User'
import { nanoid } from 'nanoid'
import { sendNotification } from '../services/notification.service'

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { sellerId, items, deliveryAddress, notes, deliveryFee = 0 } = req.body
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
      currency: 'USD',
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

    // Only seller can mark SHIPPED; only admin can make other changes
    if (!isAdmin && !isSeller && !isBuyer) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    if (!isAdmin && isSeller && status !== 'SHIPPED') {
      return res.status(403).json({ success: false, message: 'Sellers can only mark orders as SHIPPED' })
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

    order.status = 'COMPLETED'
    order.deliveredAt = new Date()
    await order.save()

    // Release escrow if exists
    if (order.escrowId) {
      const escrow = await Escrow.findById(order.escrowId)
      if (escrow && escrow.status === 'HOLDING') {
        escrow.status = 'RELEASED'
        escrow.releasedAt = new Date()
        await escrow.save()

        // Credit seller wallet
        const platformFeeRate = 0.025
        const net = escrow.amount * (1 - platformFeeRate)
        let wallet = await Wallet.findOne({ userId: order.sellerId })
        if (!wallet) {
          wallet = await Wallet.create({ userId: order.sellerId, balance: 0, pendingBalance: 0, currency: escrow.currency })
        }
        wallet.balance += net
        wallet.pendingBalance = Math.max(0, wallet.pendingBalance - escrow.amount)
        wallet.transactions.push({
          type: 'ESCROW_RELEASE',
          amount: net,
          description: `Payment for order ${order.orderNumber}`,
          reference: order._id.toString(),
          status: 'completed',
          createdAt: new Date(),
        })
        await wallet.save()
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
