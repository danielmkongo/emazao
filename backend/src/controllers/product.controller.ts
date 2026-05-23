import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Product from '../models/Product'
import { AuthRequest } from '../middleware/auth.middleware'
import slugify from 'slugify'
import { nanoid } from 'nanoid'

// GET /api/products
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, tags, organic, minPrice, maxPrice, status = 'ACTIVE', page = '1', limit = '20', q, sellerId } = req.query

    const filter: Record<string, unknown> = { status }
    if (sellerId) filter['sellerId'] = sellerId
    if (category) filter['categoryId'] = category
    if (tags) filter['tags'] = { $in: (tags as string).split(',') }
    if (organic === 'true') filter['isOrganic'] = true
    if (minPrice || maxPrice) {
      filter['price'] = {}
      if (minPrice) (filter['price'] as Record<string, number>)['$gte'] = parseFloat(minPrice as string)
      if (maxPrice) (filter['price'] as Record<string, number>)['$lte'] = parseFloat(maxPrice as string)
    }
    if (q) {
      const re = { $regex: q as string, $options: 'i' }
      filter['$or'] = [{ title: re }, { tags: re }, { origin: re }, { description: re }]
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
    const sort = { isBoosted: -1, createdAt: -1 } as any

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('sellerId', 'name username avatar isVerified')
        .populate('categoryId', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit as string)),
      Product.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: products,
      pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// POST /api/products
export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, categoryId, price, priceUnit, images, tags, condition, isOrganic, minimumOrder, availableStock, stockUnit, origin, certifications, harvestDate } = req.body as {
      title: string; description: string; categoryId: string; price: number; priceUnit: string
      images?: string[]; tags?: string[]; condition?: string; isOrganic?: boolean
      minimumOrder?: number; availableStock?: number; stockUnit?: string
      origin?: string; certifications?: string[]; harvestDate?: string
    }

    const slug = slugify(title, { lower: true, strict: true }) + '-' + nanoid(6)

    const product = await Product.create({
      sellerId: req.user!.id,
      categoryId, title, slug, description,
      price, priceUnit, images: images || [],
      tags: tags || [], condition: condition as any, isOrganic,
      minimumOrder, availableStock, stockUnit,
      origin, certifications: certifications || [],
      harvestDate: harvestDate ? new Date(harvestDate) : undefined,
    })

    res.status(201).json({ success: true, data: product })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// GET /api/products/:id
export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id']
    const filter = mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { slug: id }] }
      : { slug: id }
    const product = await Product.findOne(filter)
      .populate('sellerId', 'name username avatar isVerified country')
      .populate('categoryId', 'name slug')

    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return }
    await Product.findByIdAndUpdate(product._id, { $inc: { viewCount: 1 } })
    res.json({ success: true, data: product })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// PUT /api/products/:id
export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findOne({ _id: req.params['id'], sellerId: req.user!.id })
    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return }

    const allowed = ['title', 'description', 'price', 'priceUnit', 'images', 'tags', 'status', 'availableStock', 'condition', 'isOrganic']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    const updated = await Product.findByIdAndUpdate(product._id, updates, { new: true })
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// DELETE /api/products/:id
export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params['id'], sellerId: req.user!.id })
    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return }
    res.json({ success: true, message: 'Product deleted' })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}
