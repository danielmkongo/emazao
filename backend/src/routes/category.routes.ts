import { memo } from '../utils/memo'
import { Router } from 'express'
import { Request, Response } from 'express'
import Category from '../models/Category'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Categories change only when the seed runs.
    const categories = await memo('categories', 10 * 60_000, () => Category.find().sort({ name: 1 }).lean())
    res.set('Cache-Control', 'public, max-age=300')
    res.json({ success: true, data: categories })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug })
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' })
    res.json({ success: true, data: category })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
})

export default router
