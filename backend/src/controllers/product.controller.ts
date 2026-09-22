import { literal } from '../utils/regex'
import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Product from '../models/Product'
import Save from '../models/Save'
import { AuthRequest } from '../middleware/auth.middleware'
import slugify from 'slugify'
import { nanoid } from 'nanoid'

// GET /api/products
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, tags, organic, minPrice, maxPrice, status = 'ACTIVE', page = '1', limit = '20', q, sellerId, nutrition, sort: sortBy } = req.query

    const filter: Record<string, unknown> = {}
    if (status !== 'all') filter['status'] = status
    if (sellerId && mongoose.isValidObjectId(sellerId)) {
      filter['sellerId'] = new mongoose.Types.ObjectId(sellerId as string)
    }
    if (category) filter['categoryId'] = category
    if (tags) filter['tags'] = { $in: (tags as string).split(',') }
    if (organic === 'true') filter['isOrganic'] = true
    // Comma-separated so the nutrition section can ask for one group or several.
    if (nutrition) {
      const wanted = String(nutrition).split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
      if (wanted.length) filter['nutritionTags'] = { $in: wanted }
    }
    if (minPrice || maxPrice) {
      filter['price'] = {}
      if (minPrice) (filter['price'] as Record<string, number>)['$gte'] = parseFloat(minPrice as string)
      if (maxPrice) (filter['price'] as Record<string, number>)['$lte'] = parseFloat(maxPrice as string)
    }
    if (q) {
      const re = { $regex: literal(q), $options: 'i' }
      filter['$or'] = [{ title: re }, { tags: re }, { origin: re }, { description: re }]
    }

    // Bounded: an unchecked ?limit=100000 loaded and serialised every listing.
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const pageSize = Math.min(Math.max(parseInt(limit as string) || 20, 1), 60)
    const skip = (pageNum - 1) * pageSize
    // "recommended" keeps paid boosts on top; the explicit sorts are what a
    // shopper asked for, so boosts do not get to override them.
    const SORTS: Record<string, Record<string, 1 | -1>> = {
      recommended: { isBoosted: -1, createdAt: -1 },
      newest: { createdAt: -1 },
      price_asc: { price: 1, createdAt: -1 },
      price_desc: { price: -1, createdAt: -1 },
      popular: { orderCount: -1, viewCount: -1 },
    }
    const sort = SORTS[String(sortBy ?? 'recommended')] ?? SORTS.recommended

    // One extra row says whether there is a next page. Counting every match
    // on each request (countDocuments) read the whole active catalogue from
    // the index to produce a total the app never displayed.
    const rows = await Product.find(filter)
      .populate('sellerId', 'name username avatar isVerified')
      .populate('categoryId', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(pageSize + 1)
      .lean()
    const hasMore = rows.length > pageSize
    const products = hasMore ? rows.slice(0, pageSize) : rows

    // The viewer's own saves, so a heart on a product tile shows the truth
    // rather than always starting empty.
    const viewerId = (req as AuthRequest).user?.id
    let data: unknown[] = products
    if (viewerId && products.length) {
      const saves = await Save.find({ userId: viewerId, targetType: 'Product', targetId: { $in: products.map(p => p._id) } }).select('targetId').lean()
      const saved = new Set(saves.map(s => String(s.targetId)))
      data = products.map(p => ({ ...p, userSaved: saved.has(String(p._id)) }))
    }

    res.json({
      success: true,
      data,
      pagination: { page: pageNum, limit: pageSize, hasMore },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// POST /api/products
export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, categoryId, price, priceUnit, images, tags, condition, isOrganic, minimumOrder, availableStock, stockUnit, origin, certifications, harvestDate, nutritionTags } = req.body as {
      title: string; description: string; categoryId: string; price: number; priceUnit: string
      images?: string[]; tags?: string[]; condition?: string; isOrganic?: boolean
      minimumOrder?: number; availableStock?: number; stockUnit?: string
      origin?: string; certifications?: string[]; harvestDate?: string
      nutritionTags?: string[]
    }

    // Validate against the schema's own list rather than trusting the client:
    // an unknown value would fail on save with a cast error the seller cannot
    // act on, and these tags are read as dietary guidance.
    const VALID_NUTRITION = ['CHILDREN', 'PREGNANT', 'NURSING', 'PATIENTS', 'ELDERLY']
    const cleanNutrition = (nutritionTags ?? [])
      .map(t => String(t).toUpperCase())
      .filter(t => VALID_NUTRITION.includes(t))

    const slug = slugify(title, { lower: true, strict: true }) + '-' + nanoid(6)

    const product = await Product.create({
      sellerId: req.user!.id,
      categoryId, title, slug, description,
      price, priceUnit, images: images || [],
      tags: tags || [], condition: condition as any, isOrganic,
      nutritionTags: cleanNutrition,
      minimumOrder, availableStock, stockUnit,
      origin, certifications: certifications || [],
      harvestDate: harvestDate ? new Date(harvestDate) : undefined,
    })

    res.status(201).json({ success: true, data: product })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

const OBJECT_ID_RE = /^[a-f\d]{24}$/i

// GET /api/products/:id
export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest
    const id = String(req.params['id'] ?? '')
    const filter = OBJECT_ID_RE.test(id)
      ? { $or: [{ _id: id }, { slug: id }] }
      : { slug: id }
    const product = await Product.findOne(filter)
      .populate('sellerId', 'name username avatar isVerified country')
      .populate('categoryId', 'name slug')

    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return }
    await Product.findByIdAndUpdate(product._id, { $inc: { viewCount: 1 } })

    let userSaved = false
    if (authReq.user?.id) {
      const save = await Save.findOne({ userId: authReq.user.id, targetType: 'Product', targetId: product._id })
      userSaved = !!save
    }

    res.json({ success: true, data: { ...product.toObject(), userSaved } })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// PUT /api/products/:id
export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findOne({ _id: req.params['id'], sellerId: req.user!.id })
    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return }

    const allowed = ['title', 'description', 'price', 'priceUnit', 'images', 'tags', 'status', 'availableStock', 'stockUnit', 'minimumOrder', 'condition', 'isOrganic', 'origin', 'certifications', 'categoryId']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    const updated = await Product.findByIdAndUpdate(product._id, updates, { returnDocument: 'after' })
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
