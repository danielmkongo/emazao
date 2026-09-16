import { Router } from 'express'
import { protect, optionalProtect } from '../middleware/auth.middleware'
import { createReview, getSellerReviews, getReviewableOrders } from '../controllers/review.controller'

const router = Router()

// Public: a buyer deciding whether to trust a seller has not signed in yet.
router.get('/seller/:userId', optionalProtect, getSellerReviews)

router.get('/reviewable', protect, getReviewableOrders)
router.post('/', protect, createReview)

export default router
