import { Router } from 'express'
import express from 'express'
import { protect } from '../middleware/auth.middleware'
import { createPaymentIntent, stripeWebhook, releaseEscrow } from '../controllers/payment.controller'

const router = Router()

// Webhook needs raw body
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook)

router.use(protect)
router.post('/intent', createPaymentIntent)
router.post('/escrow/:id/release', releaseEscrow)

export default router
