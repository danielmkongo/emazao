import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { createOrder, getOrders, getOrder, updateOrderStatus, confirmDelivery, disputeOrder } from '../controllers/order.controller'
import { dispatchOrder, addTrackingEvent, trackOrder } from '../controllers/tracking.controller'

const router = Router()

router.use(protect)
router.post('/', createOrder)
router.get('/', getOrders)
// Before '/:id' — otherwise 'track' is swallowed as an order id and every
// lookup 404s on a malformed ObjectId.
router.get('/track/:trackingNumber', trackOrder)
router.get('/:id', getOrder)
router.put('/:id/status', updateOrderStatus)
router.post('/:id/confirm', confirmDelivery)
router.post('/:id/dispute', disputeOrder)
router.post('/:id/dispatch', dispatchOrder)
router.post('/:id/tracking-event', addTrackingEvent)

export default router
