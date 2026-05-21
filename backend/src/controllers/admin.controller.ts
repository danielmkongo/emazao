import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import User from '../models/User'
import Order from '../models/Order'
import Product from '../models/Product'
import Dispute from '../models/Dispute'
import Escrow from '../models/Escrow'
import Wallet from '../models/Wallet'

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { search, role, isVerified, limit = 50, page = 1 } = req.query
    const query: Record<string, any> = {}
    if (search) query.$or = [{ name: new RegExp(String(search), 'i') }, { username: new RegExp(String(search), 'i') }, { email: new RegExp(String(search), 'i') }]
    if (role) query.role = role
    if (isVerified !== undefined) query.isVerified = isVerified === 'true'

    const users = await User.find(query).select('-passwordHash -refreshToken').sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit)).limit(Number(limit))
    const total = await User.countDocuments(query)
    res.json({ success: true, data: users, total })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const verifyUser = async (req: AuthRequest, res: Response) => {
  try {
    const { verifiedType } = req.body
    const user = await User.findByIdAndUpdate(req.params.id, { isVerified: true, verifiedType }, { new: true })
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })
    res.json({ success: true, data: user })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const suspendUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isSuspended: true }, { new: true })
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })
    res.json({ success: true, data: user })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const listDisputes = async (req: AuthRequest, res: Response) => {
  try {
    const disputes = await Dispute.find().populate('orderId', 'orderNumber total').populate('raisedById', 'name username').sort({ createdAt: -1 }).limit(50)
    res.json({ success: true, data: disputes })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const resolveDispute = async (req: AuthRequest, res: Response) => {
  try {
    const { resolution } = req.body
    const dispute = await Dispute.findById(req.params.id).populate('orderId')
    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found' })

    dispute.status = resolution === 'REFUND_BUYER' ? 'RESOLVED_BUYER' : 'RESOLVED_SELLER'
    dispute.resolution = resolution
    await dispute.save()

    const order = dispute.orderId as any
    if (order?.escrowId) {
      const escrow = await Escrow.findById(order.escrowId)
      if (escrow && escrow.status === 'DISPUTED') {
        if (resolution === 'RELEASE_TO_SELLER') {
          escrow.status = 'RELEASED'
          escrow.releasedAt = new Date()
          await escrow.save()
          let wallet = await Wallet.findOne({ userId: order.sellerId })
          if (!wallet) wallet = await Wallet.create({ userId: order.sellerId, balance: 0, pendingBalance: 0, currency: escrow.currency })
          wallet.balance += escrow.amount * 0.975
          await wallet.save()
        } else if (resolution === 'REFUND_BUYER') {
          escrow.status = 'REFUNDED'
          escrow.refundedAt = new Date()
          await escrow.save()
        }
      }
    }

    res.json({ success: true, data: dispute })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getPlatformAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const [totalUsers, totalFarmers, totalBuyers, totalProducts, totalOrders, revenueResult] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'FARMER' }),
      User.countDocuments({ role: { $in: ['BUYER', 'BUSINESS_BUYER'] } }),
      Product.countDocuments({ status: 'ACTIVE' }),
      Order.countDocuments(),
      Order.aggregate([{ $match: { status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$platformFee' } } }]),
    ])
    res.json({
      success: true,
      data: {
        totalUsers, totalFarmers, totalBuyers, totalProducts, totalOrders,
        totalRevenue: revenueResult[0]?.total ?? 0,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
