import { Response } from 'express'
import mongoose from 'mongoose'
import { newOrderNumber } from '../utils/orderNumber'
import { AuthRequest } from '../middleware/auth.middleware'
import Cart from '../models/Cart'
import Checkout from '../models/Checkout'
import Order from '../models/Order'
import Product from '../models/Product'
import User from '../models/User'
import { priceItems, orderTotals, PLATFORM_FEE_RATE } from '../services/orderPricing'
import { sendNotification } from '../services/notification.service'
import { recordFingerprint } from '../services/risk/rules'

const MAX_LINES = 50

/**
 * Build the cart view: every line re-read from the live Product, grouped by
 * seller, with each seller's share priced exactly as checkout will price it.
 *
 * Unavailable lines are reported rather than silently dropped — a buyer who
 * added something yesterday should be told it has gone, not left wondering
 * why their total changed.
 */
async function buildCartView(userId: string) {
  const cart = await Cart.findOne({ userId }).lean()
  const lines = cart?.items ?? []
  if (!lines.length) {
    return { groups: [], unavailable: [], itemCount: 0, subtotal: 0, platformFee: 0, total: 0, currency: 'TZS' }
  }

  const products = await Product.find({ _id: { $in: lines.map(l => l.productId) } })
    .populate('sellerId', 'name username avatar isVerified')
    .lean()
  const byId = new Map(products.map(p => [String(p._id), p]))

  const groups = new Map<string, { seller: any; items: any[] }>()
  const unavailable: { productId: string; title: string; reason: string }[] = []

  for (const line of lines) {
    const p: any = byId.get(String(line.productId))
    if (!p || p.status !== 'ACTIVE') {
      unavailable.push({
        productId: String(line.productId),
        title: p?.title ?? 'A product',
        reason: !p ? 'no longer listed' : p.status === 'OUT_OF_STOCK' ? 'out of stock' : 'not currently for sale',
      })
      continue
    }
    const sellerKey = String(p.sellerId?._id ?? p.sellerId)
    if (!groups.has(sellerKey)) groups.set(sellerKey, { seller: p.sellerId, items: [] })
    groups.get(sellerKey)!.items.push({
      productId: String(p._id),
      slug: p.slug,
      title: p.title,
      image: p.images?.[0] ?? '',
      unitPrice: p.price,
      unit: p.stockUnit ?? p.priceUnit,
      quantity: line.quantity,
      minimumOrder: p.minimumOrder ?? 1,
      availableStock: p.availableStock,
      lineTotal: parseFloat((p.price * line.quantity).toFixed(2)),
      // Flag rather than block here — the buyer may still be adjusting.
      belowMinimum: Boolean(p.minimumOrder && line.quantity < p.minimumOrder),
    })
  }

  let subtotal = 0
  let platformFee = 0
  const groupList = [...groups.values()].map(g => {
    const gSub = parseFloat(g.items.reduce((s, i) => s + i.lineTotal, 0).toFixed(2))
    const gFee = parseFloat((gSub * PLATFORM_FEE_RATE).toFixed(2))
    subtotal += gSub
    platformFee += gFee
    return { seller: g.seller, items: g.items, subtotal: gSub, platformFee: gFee, total: parseFloat((gSub + gFee).toFixed(2)) }
  })

  return {
    groups: groupList,
    unavailable,
    itemCount: groupList.reduce((n, g) => n + g.items.length, 0),
    subtotal: parseFloat(subtotal.toFixed(2)),
    platformFee: parseFloat(platformFee.toFixed(2)),
    total: parseFloat((subtotal + platformFee).toFixed(2)),
    currency: 'TZS',
  }
}

/** GET /api/cart */
export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await buildCartView(req.user!.id) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** POST /api/cart/items — add, or increase the quantity of a line already there. */
export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const { productId, quantity } = req.body as { productId?: string; quantity?: number }
    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'A valid product is required' })
    }

    const product = await Product.findById(productId).select('status sellerId minimumOrder title').lean()
    if (!product || product.status !== 'ACTIVE') {
      return res.status(404).json({ success: false, message: 'This product is not available' })
    }
    // Buying your own listing would be a sale to yourself — the pattern the
    // self-dealing rule exists to catch — so refuse it at the door.
    if (String(product.sellerId) === req.user!.id) {
      return res.status(400).json({ success: false, message: 'You cannot buy your own product' })
    }

    const qty = Number(quantity ?? product.minimumOrder ?? 1)
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than zero' })
    }

    const cart = (await Cart.findOne({ userId: req.user!.id })) ?? new Cart({ userId: req.user!.id, items: [] })
    const existing = cart.items.find(i => String(i.productId) === productId)
    if (existing) {
      existing.quantity = parseFloat((existing.quantity + qty).toFixed(2))
    } else {
      if (cart.items.length >= MAX_LINES) {
        return res.status(400).json({ success: false, message: `A cart can hold up to ${MAX_LINES} different products` })
      }
      cart.items.push({ productId: new mongoose.Types.ObjectId(productId), quantity: qty, addedAt: new Date() })
    }
    await cart.save()

    res.status(201).json({ success: true, data: await buildCartView(req.user!.id) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** PUT /api/cart/items/:productId — set an exact quantity. Zero removes it. */
export const updateCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const productId = String(req.params['productId'] ?? '')
    const qty = Number((req.body as { quantity?: number }).quantity)
    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be zero or more' })
    }

    const cart = await Cart.findOne({ userId: req.user!.id })
    if (!cart) return res.status(404).json({ success: false, message: 'Your cart is empty' })

    const line = cart.items.find(i => String(i.productId) === productId)
    if (!line) return res.status(404).json({ success: false, message: 'That product is not in your cart' })

    if (qty === 0) cart.items = cart.items.filter(i => String(i.productId) !== productId) as any
    else line.quantity = parseFloat(qty.toFixed(2))
    await cart.save()

    res.json({ success: true, data: await buildCartView(req.user!.id) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** DELETE /api/cart/items/:productId */
export const removeFromCart = async (req: AuthRequest, res: Response) => {
  try {
    const productId = String(req.params['productId'] ?? '')
    await Cart.updateOne(
      { userId: req.user!.id },
      { $pull: { items: { productId: mongoose.isValidObjectId(productId) ? new mongoose.Types.ObjectId(productId) : productId } } }
    )
    res.json({ success: true, data: await buildCartView(req.user!.id) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** DELETE /api/cart */
export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    await Cart.updateOne({ userId: req.user!.id }, { items: [] })
    res.json({ success: true, data: await buildCartView(req.user!.id) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/cart/checkout — turn the cart into one order per seller, tied
 * together by a Checkout so they can be paid with a single approval.
 *
 * Everything is priced and validated before anything is written. Creating the
 * first seller's order and then discovering the third seller's product had sold
 * out would leave the buyer with half a purchase they never agreed to.
 */
export const checkout = async (req: AuthRequest, res: Response) => {
  try {
    const { deliveryAddress, notes } = req.body as {
      deliveryAddress?: { street?: string; city?: string; region?: string; country?: string }
      notes?: string
    }
    if (!deliveryAddress?.street || !deliveryAddress?.city || !deliveryAddress?.country) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required' })
    }

    const cart = await Cart.findOne({ userId: req.user!.id })
    if (!cart?.items.length) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' })
    }

    const priced = await priceItems(cart.items.map(i => ({ productId: String(i.productId), quantity: i.quantity })))
    if (!priced.ok) {
      return res.status(409).json({
        success: false,
        message: `${priced.message}. Update your cart and try again.`,
      })
    }
    if (priced.items.some(i => i.sellerId === req.user!.id)) {
      return res.status(400).json({ success: false, message: 'Your cart contains one of your own products' })
    }

    // Group by seller — one order each.
    const bySeller = new Map<string, typeof priced.items>()
    for (const item of priced.items) {
      if (!bySeller.has(item.sellerId)) bySeller.set(item.sellerId, [])
      bySeller.get(item.sellerId)!.push(item)
    }

    void recordFingerprint(req.user!.id, req.ip, req.get('user-agent')).catch(() => {})

    const checkoutDoc = new Checkout({ buyerId: req.user!.id, orderIds: [], total: 0, currency: 'TZS' })
    const created: any[] = []

    try {
      for (const [sellerId, items] of bySeller) {
        const totals = orderTotals(items, 0)
        const order = await Order.create({
          orderNumber: newOrderNumber(),
          buyerId: req.user!.id,
          sellerId,
          items: items.map(({ sellerId: _s, ...rest }) => rest),
          ...totals,
          currency: 'TZS',
          deliveryAddress,
          notes,
          status: 'PENDING',
          checkoutId: checkoutDoc._id,
        })
        created.push(order)
      }
    } catch (err) {
      // No multi-document transaction on a standalone Mongo, so undo by hand:
      // a buyer must never be left holding some sellers' orders from a checkout
      // that did not complete.
      await Order.deleteMany({ _id: { $in: created.map(o => o._id) } })
      throw err
    }

    checkoutDoc.orderIds = created.map(o => o._id)
    checkoutDoc.total = parseFloat(created.reduce((s, o) => s + o.total, 0).toFixed(2))
    await checkoutDoc.save()

    // The cart has become orders — empty it so the same goods cannot be checked
    // out a second time by accident.
    cart.items = [] as any
    await cart.save()

    const buyer = await User.findById(req.user!.id).select('name').lean()
    await Promise.all(created.map(o => sendNotification({
      userId: String(o.sellerId),
      type: 'NEW_ORDER',
      title: 'New order received',
      body: `${buyer?.name ?? 'A buyer'} placed order ${o.orderNumber}`,
      link: `/orders/${o._id}`,
      data: { orderId: String(o._id) },
    })))

    res.status(201).json({
      success: true,
      data: {
        checkoutId: checkoutDoc._id,
        total: checkoutDoc.total,
        currency: checkoutDoc.currency,
        orders: created.map(o => ({ _id: o._id, orderNumber: o.orderNumber, sellerId: o.sellerId, total: o.total })),
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** GET /api/cart/checkout/:id — status of a combined payment. */
export const getCheckout = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params['id'] ?? '')
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid checkout' })
    const doc = await Checkout.findById(id)
      .populate({ path: 'orderIds', select: 'orderNumber status total sellerId', populate: { path: 'sellerId', select: 'name username' } })
      .lean()
    if (!doc || String(doc.buyerId) !== req.user!.id) {
      return res.status(404).json({ success: false, message: 'Checkout not found' })
    }
    res.json({ success: true, data: doc })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
