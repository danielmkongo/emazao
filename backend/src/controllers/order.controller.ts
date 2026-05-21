import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import Escrow from '../models/Escrow'
import Wallet from '../models/Wallet'
import { nanoid } from 'nanoid'

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
    if (order.buyerId.toString() !== userId && order.sellerId.toString() !== userId) {
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

    order.status = status
    if (status === 'DELIVERED') order.deliveredAt = new Date()
    await order.save()

    res.json({ success: true, data: order })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const confirmDelivery = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    if (order.buyerId.toString() !== req.user!.id) {
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
        await wallet.save()
      }
    }

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
