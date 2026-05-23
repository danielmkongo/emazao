import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import Product from '../models/Product'
import Reel from '../models/Reel'
import { startOfMonth, subMonths, format } from 'date-fns'

export const getOverview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id)
    const now = new Date()
    const monthStart = startOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))

    const [totalRevenue, monthRevenue, lastMonthRevenue, products, reels, orders] = await Promise.all([
      Order.aggregate([
        { $match: { sellerId: userId as any, status: { $in: ['COMPLETED'] } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: { sellerId: userId as any, status: 'COMPLETED', createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: { sellerId: userId as any, status: 'COMPLETED', createdAt: { $gte: lastMonthStart, $lt: monthStart } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Product.countDocuments({ sellerId: userId }),
      Reel.countDocuments({ userId }),
      Order.countDocuments({ sellerId: userId }),
    ])

    const totalViews = await Product.aggregate([
      { $match: { sellerId: userId as any } },
      { $group: { _id: null, total: { $sum: '$viewCount' } } },
    ])

    const revenueThisMonth = monthRevenue[0]?.total ?? 0
    const revenueLastMonth = lastMonthRevenue[0]?.total ?? 0
    const revenueGrowth = revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : 0

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue[0]?.total ?? 0,
        revenueThisMonth,
        revenueLastMonth,
        revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
        totalProducts: products,
        totalReels: reels,
        totalOrders: orders,
        totalViews: totalViews[0]?.total ?? 0,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getRevenueChart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id)
    const months = 6
    const data = []

    for (let i = months - 1; i >= 0; i--) {
      const start = startOfMonth(subMonths(new Date(), i))
      const end = startOfMonth(subMonths(new Date(), i - 1))
      const result = await Order.aggregate([
        { $match: { sellerId: userId as any, status: 'COMPLETED', createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      ])
      data.push({
        month: format(start, 'MMM'),
        revenue: result[0]?.revenue ?? 0,
        orders: result[0]?.orders ?? 0,
      })
    }

    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getProductsAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const products = await Product.find({ sellerId: req.user!.id })
      .select('title viewCount likeCount orderCount rating')
      .sort({ viewCount: -1 })
      .limit(10)
    res.json({ success: true, data: products })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
