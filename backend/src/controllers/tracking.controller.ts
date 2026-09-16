import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth.middleware'
import Order from '../models/Order'
import { sendNotification } from '../services/notification.service'

/**
 * Tracking reference: EMZ-TRK-8F3K2Q7D.
 *
 * Random rather than sequential, because a sequential shipping reference leaks
 * order volume to anyone holding two of them, and lets a stranger guess a
 * neighbouring number to look up a shipment that is not theirs.
 */
function generateTrackingNumber(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 — these get misread aloud
  let out = ''
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `EMZ-TRK-${out}`
}

/**
 * POST /api/orders/:id/dispatch — the seller says the goods have left.
 */
export const dispatchOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { carrier, note, estimatedDelivery } = req.body as {
      carrier?: string; note?: string; estimatedDelivery?: string
    }

    const order = await Order.findById(req.params['id'])
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    // Only the seller dispatches. A buyer marking their own order shipped would
    // move it toward release of funds without anything having moved.
    if (String(order.sellerId) !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Only the seller can dispatch this order' })
    }
    if (order.dispatchedAt) {
      return res.status(409).json({
        success: false,
        message: 'This order has already been dispatched',
        data: { trackingNumber: order.trackingNumber },
      })
    }
    // Nothing can be dispatched that is already finished or cancelled. Allowing
    // it produced timelines reading "dispatched 16th, delivered 11th", which is
    // worse than no tracking at all — it makes the record untrustworthy.
    const UNDISPATCHABLE = ['CANCELLED', 'REFUNDED', 'DELIVERED', 'COMPLETED']
    if (UNDISPATCHABLE.includes(order.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot dispatch an order that is already ${order.status.toLowerCase()}`,
      })
    }

    // Retry on the astronomically unlikely collision rather than failing the
    // dispatch — the unique index is the real guard.
    let trackingNumber = generateTrackingNumber()
    for (let i = 0; i < 5 && await Order.exists({ trackingNumber }); i++) {
      trackingNumber = generateTrackingNumber()
    }

    order.trackingNumber = trackingNumber
    order.carrier = carrier?.trim()
    order.dispatchedAt = new Date()
    order.status = 'SHIPPED'
    if (estimatedDelivery) order.estimatedDelivery = new Date(estimatedDelivery)
    order.trackingEvents = [
      ...(order.trackingEvents ?? []),
      { status: 'DISPATCHED', note: note?.trim() || 'Package handed to the carrier', at: new Date() },
    ]
    await order.save()

    await sendNotification({
      userId: String(order.buyerId),
      type: 'ORDER',
      title: 'Your order is on its way',
      body: `Order ${order.orderNumber} has been dispatched. Tracking: ${trackingNumber}`,
      link: `/orders/${order._id}`,
    })

    res.json({ success: true, data: order })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/orders/:id/tracking-event — a further update along the way.
 */
export const addTrackingEvent = async (req: AuthRequest, res: Response) => {
  try {
    const { status, note, location } = req.body as { status?: string; note?: string; location?: string }
    if (!status?.trim()) {
      return res.status(400).json({ success: false, message: 'A status is required' })
    }

    const order = await Order.findById(req.params['id'])
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    const isSeller = String(order.sellerId) === req.user!.id
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)
    if (!isSeller && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only the seller can update tracking' })
    }

    const normalised = status.trim().toUpperCase().replace(/\s+/g, '_')
    order.trackingEvents = [
      ...(order.trackingEvents ?? []),
      { status: normalised, note: note?.trim(), location: location?.trim(), at: new Date() },
    ]

    // Keep the order's own status in step with the two events that change what
    // the rest of the platform does — delivery starts the escrow clock.
    if (normalised === 'DELIVERED') {
      order.status = 'DELIVERED'
      order.deliveredAt = new Date()
      await sendNotification({
        userId: String(order.buyerId),
        type: 'ORDER',
        title: 'Your order has arrived',
        body: `Order ${order.orderNumber} has been marked delivered.`,
        link: `/orders/${order._id}`,
      })
    }
    await order.save()

    res.json({ success: true, data: order })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/orders/track/:trackingNumber — "Track my product".
 *
 * Requires sign-in and returns only what the caller is party to. A tracking
 * number printed on a delivery note is not a secret, so it must not be enough
 * on its own to read a stranger's delivery address.
 */
export const trackOrder = async (req: AuthRequest, res: Response) => {
  try {
    const raw = String(req.params['trackingNumber'] ?? '').trim().toUpperCase()
    if (!raw) return res.status(400).json({ success: false, message: 'A tracking number is required' })

    const query = mongoose.isValidObjectId(raw)
      ? { $or: [{ trackingNumber: raw }, { _id: raw }] }
      : { $or: [{ trackingNumber: raw }, { orderNumber: raw }] }

    const order = await Order.findOne(query)
      .populate('buyerId', 'name username')
      .populate('sellerId', 'name username')
      .lean()

    if (!order) {
      return res.status(404).json({ success: false, message: 'No shipment found with that number' })
    }

    const uid = req.user!.id
    const isParty = String((order.buyerId as any)?._id ?? order.buyerId) === uid
      || String((order.sellerId as any)?._id ?? order.sellerId) === uid
    if (!isParty && !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
      // Deliberately the same message as a miss: confirming that a number is
      // real, just not yours, is itself information worth withholding.
      return res.status(404).json({ success: false, message: 'No shipment found with that number' })
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier,
        status: order.status,
        dispatchedAt: order.dispatchedAt,
        estimatedDelivery: order.estimatedDelivery,
        deliveredAt: order.deliveredAt,
        buyer: (order.buyerId as any)?.name,
        seller: (order.sellerId as any)?.name,
        events: (order.trackingEvents ?? []).slice().sort(
          (a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime()
        ),
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
