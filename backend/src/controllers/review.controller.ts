import { Response, Request } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Review from '../models/Review'
import Order from '../models/Order'
import User from '../models/User'
import { sendNotification } from '../services/notification.service'

/** Orders that represent a completed exchange worth reviewing. */
const REVIEWABLE = ['DELIVERED', 'COMPLETED']

/**
 * POST /api/reviews — rate a seller after an order.
 *
 * Reviews are tied to an order rather than left open, because an untethered
 * rating system on a marketplace is a harassment surface: anyone could bury a
 * competitor without ever having traded with them.
 */
export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, rating, title, content } = req.body as {
      orderId?: string; rating?: number; title?: string; content?: string
    }

    const score = Number(rating)
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be a whole number from 1 to 5' })
    }
    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Please say something about the service' })
    }
    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: 'A valid order is required' })
    }

    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    // The buyer reviews the seller — not the other way round, and not a third
    // party who happened to learn the order id.
    if (String(order.buyerId) !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Only the buyer on this order can review it' })
    }
    if (!REVIEWABLE.includes(order.status)) {
      return res.status(409).json({
        success: false,
        message: 'You can review once the order has been delivered',
      })
    }

    const already = await Review.findOne({ orderId: order._id, authorId: req.user!.id })
    if (already) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this order' })
    }

    const review = await Review.create({
      authorId: req.user!.id,
      targetId: order.sellerId,
      orderId: order._id,
      rating: score,
      title: title?.trim(),
      content: content.trim(),
      // Earned, never claimed: it is true because the order exists and was
      // delivered, so the badge cannot be faked.
      isVerifiedPurchase: true,
    })
    await review.populate('authorId', 'name username avatar')

    await sendNotification({
      userId: String(order.sellerId),
      type: 'REVIEW',
      title: `New ${score}-star review`,
      body: `A buyer reviewed your service on order ${order.orderNumber}.`,
      link: `/farm/${(await User.findById(order.sellerId).select('username').lean())?.username ?? ''}`,
    })

    res.status(201).json({ success: true, data: review })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/reviews/seller/:userId — a seller's reviews and rating summary.
 */
export const getSellerReviews = async (req: Request, res: Response) => {
  try {
    const userId = String(req.params['userId'] ?? '')
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller' })
    }

    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query['limit'] ?? '20')) || 20))

    const [reviews, total, summary] = await Promise.all([
      Review.find({ targetId: userId })
        .populate('authorId', 'name username avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments({ targetId: userId }),
      Review.aggregate([
        { $match: { targetId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
    ])

    // The distribution matters as much as the average: four 5s and one 1 is a
    // different seller from five 4s, and both average 4.2.
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let sum = 0
    let count = 0
    for (const row of summary) {
      distribution[row._id] = row.count
      sum += row._id * row.count
      count += row.count
    }

    res.json({
      success: true,
      data: {
        reviews,
        total,
        page,
        pages: Math.ceil(total / limit),
        average: count ? Math.round((sum / count) * 10) / 10 : null,
        count,
        distribution,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/reviews/reviewable — the caller's delivered orders not yet reviewed.
 * Lets the app prompt for a review instead of hoping buyers go looking.
 */
export const getReviewableOrders = async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find({ buyerId: req.user!.id, status: { $in: REVIEWABLE } })
      .populate('sellerId', 'name username avatar')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    const reviewed = await Review.find({ authorId: req.user!.id })
      .select('orderId')
      .lean()
    const done = new Set(reviewed.map(r => String(r.orderId)))

    res.json({
      success: true,
      data: orders.filter(o => !done.has(String(o._id))).map(o => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        total: o.total,
        deliveredAt: o.deliveredAt,
        seller: o.sellerId,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
