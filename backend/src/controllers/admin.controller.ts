import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import User from '../models/User'
import Order from '../models/Order'
import Product from '../models/Product'
import Dispute from '../models/Dispute'
import { releaseEscrow, refundBuyer, sendRefund } from '../services/money.service'
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

    // Refund progress lives on the escrow; show it next to the dispute so a
    // failed refund payout is visible and can be retried.
    const escrows = await Escrow.find({ orderId: { $in: disputes.map(d => (d.orderId as any)?._id).filter(Boolean) } })
      .select('orderId status refundStatus refundError').lean()
    const byOrder = new Map(escrows.map(e => [String(e.orderId), e]))
    const data = disputes.map(d => {
      const e = byOrder.get(String((d.orderId as any)?._id))
      return { ...d.toObject(), escrow: e ? { _id: e._id, status: e.status, refundStatus: e.refundStatus, refundError: e.refundError } : null }
    })

    res.json({ success: true, data, pagination: { page: Number(page), limit: Number(limit), total } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const resolveDispute = async (req: AuthRequest, res: Response) => {
  try {
    const { resolution } = req.body
    if (!['RELEASE_TO_SELLER', 'REFUND_BUYER'].includes(resolution)) {
      return res.status(400).json({ success: false, message: 'Resolution must be RELEASE_TO_SELLER or REFUND_BUYER' })
    }
    // Claim the dispute first so two admins cannot resolve it both ways.
    const dispute = await Dispute.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['OPEN', 'UNDER_REVIEW', 'ESCALATED'] } },
      { status: resolution === 'REFUND_BUYER' ? 'RESOLVED_BUYER' : 'RESOLVED_SELLER', resolution },
      { new: true },
    ).populate('orderId')
    if (!dispute) return res.status(409).json({ success: false, message: 'This dispute was already resolved' })

    const order = dispute.orderId as any
    // Real money moves here: the seller's wallet is credited, or the buyer's own
    // mobile-money wallet is paid back. Refunds used to only relabel the escrow.
    const money = resolution === 'RELEASE_TO_SELLER'
      ? await releaseEscrow(String(order._id), 'DISPUTE', 'DISPUTED')
      : await refundBuyer(String(order._id), 'DISPUTED')

    // Money moved here, so this is the entry an auditor is most likely to need.
    await recordAudit(req, {
      action: 'DISPUTE_RESOLVE',
      targetType: 'Dispute',
      targetId: String(dispute._id),
      targetLabel: order?.orderNumber,
      summary: `Resolved dispute on order ${order?.orderNumber ?? '—'} as ${resolution}`,
      meta: { resolution, orderTotal: order?.total, platformFee: order?.platformFee, outcome: money },
    })

    res.json({ success: true, data: dispute, outcome: money })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** POST /api/admin/escrows/:id/retry-refund — re-send a refund whose payout failed. */
export const retryRefund = async (req: AuthRequest, res: Response) => {
  try {
    const result = await sendRefund(String(req.params.id))
    await recordAudit(req, {
      action: 'REFUND_RETRY', targetType: 'Escrow', targetId: String(req.params.id),
      summary: result.sent ? 'Refund payout re-sent' : `Refund retry failed: ${result.error ?? 'unknown'}`,
    })
    if (!result.sent) return res.status(502).json({ success: false, message: result.error ?? 'Refund could not be sent' })
    res.json({ success: true })
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
