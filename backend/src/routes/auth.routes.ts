import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { register, login, refresh, logout, sendOtp, verifyOtp, forgotPassword, resetPassword } from '../controllers/auth.controller'
import { protect } from '../middleware/auth.middleware'

const router = Router()

// Tighter than the global API limiter — this endpoint sends email, so it needs
// its own cap to prevent it being used to spam a victim's inbox.
const forgotPasswordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false })

router.post('/register', register)
// Password guessing is limited per address and account, separately from the
// general budget, so a flood of attempts cannot also lock everyone else out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.email ?? '').toLowerCase()}`,
  standardHeaders: true,
  legacyHeaders: false,
})
router.post('/login', loginLimiter, login)
router.post('/refresh', refresh)
router.post('/logout', protect, logout)
router.post('/send-otp', protect, sendOtp)
router.post('/verify-otp', protect, verifyOtp)
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword)
router.post('/reset-password', resetPassword)

export default router
