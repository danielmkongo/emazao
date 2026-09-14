import { Response } from 'express'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import { env } from '../config/env'
import { recordAudit } from '../services/audit.service'
import AuditLog from '../models/AuditLog'
import PlatformSetting from '../models/PlatformSetting'
import User from '../models/User'
import Order from '../models/Order'
import Product from '../models/Product'
import Dispute from '../models/Dispute'
import RiskFlag from '../models/RiskFlag'
import VerificationProfile from '../models/VerificationProfile'
import LiveSession from '../models/LiveSession'
import Reel from '../models/Reel'
import Message from '../models/Message'

// Orders that represent money actually committed. PENDING is excluded because an
// unpaid order is an intention, not a transaction — counting it would inflate
// volume with abandoned checkouts.
const SETTLED = ['PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

/** GET /api/admin/overview — headline numbers for the dashboard. */
export const getOverview = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers, newUsers7d, suspendedUsers,
      totalOrders, ordersByStatus,
      volumeAll, volume30d,
      activeProducts, openDisputes, openFlags, pendingVerifications,
      signupSeries,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: daysAgo(7) } }),
      User.countDocuments({ isSuspended: true }),
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: { $in: SETTLED } } },
        { $group: { _id: null, gross: { $sum: '$total' }, fees: { $sum: '$platformFee' }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { status: { $in: SETTLED }, createdAt: { $gte: daysAgo(30) } } },
        { $group: { _id: null, gross: { $sum: '$total' }, fees: { $sum: '$platformFee' }, count: { $sum: 1 } } },
      ]),
      Product.countDocuments({ status: 'ACTIVE' }),
      Dispute.countDocuments({ status: { $in: ['OPEN', 'UNDER_REVIEW', 'ESCALATED'] } }),
      RiskFlag.countDocuments({ status: 'OPEN' }),
      VerificationProfile.countDocuments({ status: 'PENDING_REVIEW' }),
      // 14-day signup trend for the dashboard sparkline.
      User.aggregate([
        { $match: { createdAt: { $gte: daysAgo(14) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ])

    // Second wave: the operational detail. Kept out of the batch above so the
    // headline numbers are not held up by the heavier grouping work.
    const [
      revenueSeries, usersByRole, topSellers, liveNow,
      reels24h, messages24h, newUsers24h, orders24h,
      verificationFunnel, disputeTotal,
    ] = await Promise.all([
      // Daily gross and fees for the last 14 days, for the chart.
      Order.aggregate([
        { $match: { status: { $in: SETTLED }, createdAt: { $gte: daysAgo(14) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            gross: { $sum: '$total' },
            fees: { $sum: '$platformFee' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      // Who is actually carrying the marketplace.
      Order.aggregate([
        { $match: { status: { $in: SETTLED } } },
        { $group: { _id: '$sellerId', gross: { $sum: '$total' }, orders: { $sum: 1 } } },
        { $sort: { gross: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'seller' } },
        { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
        { $project: { gross: 1, orders: 1, name: '$seller.name', username: '$seller.username', avatar: '$seller.avatar' } },
      ]),
      LiveSession.find().select('broadcasterId title viewerCount startedAt')
        .populate('broadcasterId', 'name username').limit(10).lean(),
      Reel.countDocuments({ createdAt: { $gte: daysAgo(1) } }),
      Message.countDocuments({ createdAt: { $gte: daysAgo(1) } }),
      User.countDocuments({ createdAt: { $gte: daysAgo(1) } }),
      Order.countDocuments({ createdAt: { $gte: daysAgo(1) } }),
      VerificationProfile.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Dispute.countDocuments(),
    ])

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, new7d: newUsers7d, suspended: suspendedUsers },
        orders: {
          total: totalOrders,
          byStatus: Object.fromEntries(ordersByStatus.map(o => [o._id, o.count])),
        },
        volume: {
          grossAllTime: volumeAll[0]?.gross ?? 0,
          feesAllTime: volumeAll[0]?.fees ?? 0,
          countAllTime: volumeAll[0]?.count ?? 0,
          gross30d: volume30d[0]?.gross ?? 0,
          fees30d: volume30d[0]?.fees ?? 0,
          count30d: volume30d[0]?.count ?? 0,
          currency: 'TZS',
        },
        // The work queues — what an admin opening this page needs to act on.
        queues: { openDisputes, openFlags, pendingVerifications },
        catalogue: { activeProducts },
        signupSeries: signupSeries.map(d => ({ date: d._id, count: d.count })),

        revenueSeries: revenueSeries.map(d => ({ date: d._id, gross: d.gross, fees: d.fees, count: d.count })),
        usersByRole: Object.fromEntries(usersByRole.map(r => [r._id ?? 'UNKNOWN', r.count])),
        topSellers,
        liveNow: liveNow.map((l: any) => ({
          title: l.title,
          viewerCount: l.viewerCount,
          startedAt: l.startedAt,
          broadcaster: l.broadcasterId?.name ?? 'Unknown',
          username: l.broadcasterId?.username,
        })),
        // Last 24h, so staff can tell at a glance whether the platform is awake.
        pulse24h: { newUsers: newUsers24h, orders: orders24h, reels: reels24h, messages: messages24h },
        verificationFunnel: Object.fromEntries(verificationFunnel.map(v => [v._id, v.count])),
        // Share of all orders that ended in a dispute — the trust number.
        disputeRate: totalOrders ? disputeTotal / totalOrders : 0,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** GET /api/admin/transactions — paged order ledger with totals for the filter. */
export const listTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '25')) || 25))
    const { status, from, to, q } = req.query as Record<string, string | undefined>

    const filter: Record<string, unknown> = {}
    if (status && status !== 'ALL') filter['status'] = status
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range['$gte'] = new Date(from)
      // Inclusive of the whole end day; a bare date parses to midnight, which
      // would otherwise drop everything that happened on the day selected.
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); range['$lte'] = d }
      filter['createdAt'] = range
    }
    if (q) {
      // Order reference, or the id itself if a full ObjectId was pasted in.
      const or: Record<string, unknown>[] = [{ orderNumber: new RegExp(q, 'i') }]
      if (mongoose.isValidObjectId(q)) or.push({ _id: q })
      filter['$or'] = or
    }

    const [rows, total, totals] = await Promise.all([
      Order.find(filter)
        .populate('buyerId', 'name email username')
        .populate('sellerId', 'name email username')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
      // Totals for the whole filtered set, not just the page on screen — a
      // per-page sum would be a meaningless number to an auditor.
      Order.aggregate([
        { $match: filter },
        { $group: { _id: null, gross: { $sum: '$total' }, fees: { $sum: '$platformFee' } } },
      ]),
    ])

    res.json({
      success: true,
      data: {
        rows, page, limit, total,
        pages: Math.ceil(total / limit),
        totals: { gross: totals[0]?.gross ?? 0, fees: totals[0]?.fees ?? 0, currency: 'TZS' },
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** GET /api/admin/settings */
export const getSettings = async (_req: AuthRequest, res: Response) => {
  try {
    // Upsert-on-read so a fresh deployment has defaults without a migration step.
    const settings = await PlatformSetting.findOneAndUpdate(
      { key: 'platform' },
      { $setOnInsert: { key: 'platform' } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
    res.json({ success: true, data: settings })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** PUT /api/admin/settings */
export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    // Allow-list the writable fields: spreading req.body would let a caller set
    // `key`, `_id` or anything else the schema happens to gain later.
    const allowed = [
      'commissionPercent', 'minPayoutAmount', 'maintenanceMode', 'maintenanceMessage',
      'allowRegistrations', 'requireVerificationToSell', 'autoApproveProducts', 'supportEmail',
    ] as const

    const update: Record<string, unknown> = {}
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k]

    if (update['commissionPercent'] !== undefined) {
      const c = Number(update['commissionPercent'])
      if (!Number.isFinite(c) || c < 0 || c > 50) {
        return res.status(400).json({ success: false, message: 'commissionPercent must be between 0 and 50' })
      }
    }

    const before = await PlatformSetting.findOne({ key: 'platform' }).lean()
    const settings = await PlatformSetting.findOneAndUpdate(
      { key: 'platform' },
      { ...update, updatedBy: req.user!.id },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    // Record what actually changed, so the trail reads "commissionPercent: 5 → 7"
    // rather than just "settings updated".
    const changed = Object.keys(update).filter(k => String((before as any)?.[k]) !== String((settings as any)?.[k]))
    await recordAudit(req, {
      action: 'SETTINGS_UPDATE',
      targetType: 'PlatformSetting',
      targetId: 'platform',
      summary: changed.length
        ? `Updated ${changed.map(k => `${k}: ${(before as any)?.[k]} → ${(settings as any)?.[k]}`).join(', ')}`
        : 'Saved settings with no effective change',
      meta: { changed },
    })

    res.json({ success: true, data: settings })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/users/:id/password-reset
 *
 * Support path for "I never got the reset email". Issues the same hashed,
 * expiring token the self-service flow uses and hands the admin a one-time link
 * to pass to the user. It deliberately does NOT set a password: an admin who can
 * choose someone's password can then sign in as them, and no audit trail can
 * distinguish that from the real user afterwards.
 */
export const issuePasswordReset = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params['id'])
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })

    const token = crypto.randomBytes(32).toString('hex')
    user.resetPasswordTokenHash = crypto.createHash('sha256').update(token).digest('hex')
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000)
    await user.save()

    await recordAudit(req, {
      action: 'PASSWORD_RESET_ISSUED',
      targetType: 'User',
      targetId: String(user._id),
      targetLabel: user.email,
      summary: `Issued a password reset link for ${user.email}`,
    })

    res.json({
      success: true,
      data: {
        resetLink: `${env.CLIENT_URL}/reset-password?token=${token}`,
        expiresAt: user.resetPasswordExpires,
        email: user.email,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** GET /api/admin/audit — the trail, newest first. */
export const listAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50')) || 50))
    const { action, actor } = req.query as Record<string, string | undefined>

    const filter: Record<string, unknown> = {}
    if (action && action !== 'ALL') filter['action'] = action
    if (actor) filter['actorEmail'] = new RegExp(actor, 'i')

    const [rows, total, actions] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(filter),
      AuditLog.distinct('action'),
    ])

    res.json({
      success: true,
      data: { rows, page, limit, total, pages: Math.ceil(total / limit), actions: actions.sort() },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
