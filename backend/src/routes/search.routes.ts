import { Router } from 'express'
import { Request, Response } from 'express'
import Product from '../models/Product'
import User from '../models/User'
import Reel from '../models/Reel'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, type } = req.query
    if (!q) { res.json({ success: true, data: { products: [], users: [], reels: [] } }); return }

    const regex = new RegExp(q as string, 'i')

    const [products, users, reels] = await Promise.all([
      (!type || type === 'products')
        ? Product.find({ $or: [{ title: regex }, { tags: regex }], status: 'ACTIVE' })
            .populate('sellerId', 'name username avatar isVerified')
            .limit(10)
        : Promise.resolve([]),
      (!type || type === 'users')
        ? User.find({ $or: [{ name: regex }, { username: regex }], role: { $in: ['FARMER', 'BUSINESS_BUYER'] } })
            .select('name username avatar isVerified role')
            .limit(10)
        : Promise.resolve([]),
      (!type || type === 'reels')
        ? Reel.find({ $or: [{ caption: regex }, { tags: regex }], status: 'PUBLISHED' })
            .populate('userId', 'name username avatar')
            .limit(10)
        : Promise.resolve([]),
    ])

    res.json({ success: true, data: { products, users, reels } })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
})

router.get('/trending', async (_req: Request, res: Response) => {
  try {
    const products = await Product.find({ status: 'ACTIVE' })
      .sort({ viewCount: -1 })
      .limit(10)
      .select('title slug images price priceUnit viewCount')
    res.json({ success: true, data: products })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
})

export default router
