import { Router } from 'express'
import { register, login, refresh, logout, sendOtp, verifyOtp } from '../controllers/auth.controller'
import { protect } from '../middleware/auth.middleware'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', protect, logout)
router.post('/send-otp', protect, sendOtp)
router.post('/verify-otp', protect, verifyOtp)

export default router
