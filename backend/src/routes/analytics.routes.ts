import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { getOverview, getRevenueChart, getProductsAnalytics } from '../controllers/analytics.controller'

const router = Router()

router.use(protect)
router.get('/overview', getOverview)
router.get('/revenue', getRevenueChart)
router.get('/products', getProductsAnalytics)

export default router
