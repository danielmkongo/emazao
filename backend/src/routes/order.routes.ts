import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { createOrder, getOrders, getOrder, updateOrderStatus, confirmDelivery, disputeOrder } from '../controllers/order.controller'

const router = Router()

router.use(protect)
router.post('/', createOrder)
router.get('/', getOrders)
router.get('/:id', getOrder)
router.put('/:id/status', updateOrderStatus)
router.post('/:id/confirm', confirmDelivery)
router.post('/:id/dispute', disputeOrder)

export default router
