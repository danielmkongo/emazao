import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import User from '../models/User'
import Order from '../models/Order'
import Product from '../models/Product'
import Dispute from '../models/Dispute'
import Escrow from '../models/Escrow'
import Wallet from '../models/Wallet'
import { escapeRegex } from '../utils/regexEscape'
import { recordAudit } from '../services/audit.service'

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { search, role, isVerified, limit = 50, page = 1 } = req.query
    const query: Record<string, any> = {}
    if (search) {
      const re = new RegExp(escapeRegex(String(search).slice(0, 100)), 'i')
      query.$or = [{ name: re }, { username: re }, { email: re }]
    }
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
    const user = await User.findByIdAndUpdate(req.params.id, { isVerified: true, verifiedType }, { returnDocument: 'after' })
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })
    await recordAudit(req, {
      action: 'USER_VERIFY', targetType: 'User', targetId: String(user._id), targetLabel: user.email,
      summary: `Marked ${user.email} verified${verifiedType ? ` (${verifiedType})` : ''}`,
    })
    res.json({ success: true, data: user })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const suspendUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isSuspended: true }, { returnDocument: 'after' })
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })
    await recordAudit(req, {
      action: 'USER_SUSPEND', targetType: 'User', targetId: String(user._id), targetLabel: user.email,
      summary: `Suspended ${user.email}`,
      meta: { reason: req.body?.reason },
    })
    res.json({ success: true, data: user })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const unsuspendUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isSuspended: false }, { returnDocument: 'after' })
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })
    await recordAudit(req, {
      action: 'USER_UNSUSPEND', targetType: 'User', targetId: String(user._id), targetLabel: user.email,
      summary: `Lifted suspension on ${user.email}`,
    })
    res.json({ success: true, data: user })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const listDisputes = async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 50 } = req.query
    const query: Record<string, any> = {}
    if (status) query.status = status

    const disputes = await Dispute.find(query)
      .populate('orderId', 'orderNumber total')
      .populate('raisedById', 'name username')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
    const total = await Dispute.countDocuments(query)

    res.json({ success: true, data: disputes, pagination: { page: Number(page), limit: Number(limit), total } })
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
      if (resolution === 'RELEASE_TO_SELLER') {
        // The escrow's own DISPUTED → RELEASED transition is the mutex, same
        // pattern as the buyer- and admin-triggered release paths.
        const escrow = await Escrow.findOneAndUpdate(
          { _id: order.escrowId, status: 'DISPUTED' },
          { status: 'RELEASED', releasedAt: new Date() },
          { new: true }
        )
        if (escrow) {
          const net = order.total - order.platformFee
          await Wallet.findOneAndUpdate(
            { userId: order.sellerId },
            {
              $inc: { balance: net, pendingBalance: -escrow.amount },
              $push: {
                transactions: {
                  type: 'ESCROW_RELEASE',
                  amount: net,
                  description: `Dispute resolved for order ${order.orderNumber}`,
                  reference: order._id.toString(),
                  status: 'completed',
                  createdAt: new Date(),
                },
              },
            },
            { upsert: true, setDefaultsOnInsert: true }
          )
        }
      } else if (resolution === 'REFUND_BUYER') {
        await Escrow.findOneAndUpdate(
          { _id: order.escrowId, status: 'DISPUTED' },
          { status: 'REFUNDED', refundedAt: new Date() }
        )
      }
    }

    // Money moved here, so this is the entry an auditor is most likely to need.
    await recordAudit(req, {
      action: 'DISPUTE_RESOLVE',
      targetType: 'Dispute',
      targetId: String(dispute._id),
      targetLabel: order?.orderNumber,
      summary: `Resolved dispute on order ${order?.orderNumber ?? '—'} as ${resolution}`,
      meta: { resolution, orderTotal: order?.total, platformFee: order?.platformFee },
    })

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
