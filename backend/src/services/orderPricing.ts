import mongoose from 'mongoose'
import Product from '../models/Product'

export interface PricedItem {
  productId: mongoose.Types.ObjectId
  sellerId: string
  title: string
  image: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

export type PricingResult =
  | { ok: true; items: PricedItem[] }
  | { ok: false; message: string }

/** Platform commission on the goods subtotal. One definition, used everywhere. */
export const PLATFORM_FEE_RATE = 0.025

/**
 * Turn client-supplied { productId, quantity } pairs into priced line items,
 * deriving price, seller and title from the real Product records.
 *
 * Shared by single-seller Buy Now and the multi-seller cart so the two cannot
 * drift apart. The client is only ever trusted for which product and how many:
 * a price or seller id in the request is ignored, because a buyer who could set
 * either could pay whatever they liked or route the payout to someone who never
 * listed the goods.
 */
export async function priceItems(rawItems: unknown): Promise<PricingResult> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, message: 'Order must include at least one item' }
  }

  const productIds = [...new Set(rawItems.map((i: any) => String(i?.productId)))]
    .filter(id => mongoose.isValidObjectId(id))
  const products = await Product.find({ _id: { $in: productIds }, status: 'ACTIVE' })
  const productMap = new Map(products.map(p => [p._id.toString(), p]))

  const items: PricedItem[] = []
  for (const raw of rawItems as any[]) {
    const product = productMap.get(String(raw?.productId))
    if (!product) {
      return { ok: false, message: 'One of the items in this order is no longer available' }
    }
    const quantity = Number(raw.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, message: `Invalid quantity for ${product.title}` }
    }
    if (product.minimumOrder && quantity < product.minimumOrder) {
      return {
        ok: false,
        message: `${product.title} requires a minimum order of ${product.minimumOrder} ${product.stockUnit ?? ''}`.trim(),
      }
    }
    items.push({
      productId: product._id,
      sellerId: product.sellerId.toString(),
      title: product.title,
      image: product.images[0] ?? '',
      quantity,
      unit: product.stockUnit ?? product.priceUnit,
      unitPrice: product.price,
      totalPrice: Math.round(product.price * quantity),
    })
  }

  return { ok: true, items }
}

/**
 * Money for one seller's share: goods, delivery and the platform's cut, in
 * whole shillings. Mobile money cannot move fractions, so a total of
 * 2,265.25 would either be rejected or charged differently from what the
 * buyer was shown.
 */
export function orderTotals(items: PricedItem[], deliveryFee = 0) {
  const subtotal = Math.round(items.reduce((sum, i) => sum + i.totalPrice, 0))
  const safeDelivery = Math.round(Math.max(0, Number(deliveryFee) || 0))
  const platformFee = Math.round(subtotal * PLATFORM_FEE_RATE)
  const total = subtotal + safeDelivery + platformFee
  return { subtotal, deliveryFee: safeDelivery, platformFee, total }
}
