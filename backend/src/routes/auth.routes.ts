import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { register, login, refresh, logout, sendOtp, verifyOtp, forgotPassword, resetPassword } from '../controllers/auth.controller'
import { protect } from '../middleware/auth.middleware'

const router = Router()

// Tighter than the global API limiter — this endpoint sends email, so it needs
// its own cap to prevent it being used to spam a victim's inbox.
const forgotPasswordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false })

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', protect, logout)
router.post('/send-otp', protect, sendOtp)
router.post('/verify-otp', protect, verifyOtp)
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword)
router.post('/reset-password', resetPassword)

export default router
