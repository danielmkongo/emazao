import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import { initiateCollection, verifyCollection, releaseEscrowByAdmin, startCardCheckout, cardMethods } from '../controllers/payment.controller'

const router = Router()

// The webhook is mounted directly on the app in app.ts because it must not sit
// behind `protect` — the provider authenticates with a payload checksum, not a
// session token.

router.use(protect)
router.get('/methods', cardMethods)
router.post('/collect', initiateCollection)
router.post('/card/checkout', startCardCheckout)
router.post('/verify', verifyCollection)
router.post('/escrow/:id/release', requireRole('ADMIN', 'SUPER_ADMIN'), releaseEscrowByAdmin)

export default router
