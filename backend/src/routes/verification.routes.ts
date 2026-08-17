import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { protect } from '../middleware/auth.middleware'
import { upload } from '../middleware/upload.middleware'
import {
  getMyVerification, getPayoutEligibility, submitNida,
  createLivenessChallenge, verifyLiveness, uploadDocument, submitForReview,
} from '../controllers/verification.controller'

const router = Router()

router.use(protect)

// Identity endpoints are brute-forceable in a way ordinary API calls are not: a
// NIDA number can be guessed, and unlimited liveness attempts let an attacker
// keep rerolling challenges until they get a sequence matching a video they hold.
const identityLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false })
const livenessLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false })

router.get('/me', getMyVerification)
router.get('/payout-eligibility', getPayoutEligibility)
router.post('/nida', identityLimiter, submitNida)
router.post('/liveness/challenge', livenessLimiter, createLivenessChallenge)
router.post('/liveness/verify', livenessLimiter, verifyLiveness)
router.post('/document', identityLimiter, upload.single('file'), uploadDocument)
router.post('/submit', submitForReview)

export default router
