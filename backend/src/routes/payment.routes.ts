import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import { createPaymentIntent, releaseEscrow } from '../controllers/payment.controller'

const router = Router()

// Webhook is mounted directly on the app (before the global JSON body-parser) in
// app.ts, since it needs the raw request body to verify its Stripe signature.

router.use(protect)
router.post('/intent', createPaymentIntent)
router.post('/escrow/:id/release', requireRole('ADMIN', 'SUPER_ADMIN'), releaseEscrow)

export default router
