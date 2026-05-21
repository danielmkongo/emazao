import { Router } from 'express'
import { getMe, updateMe, getProfile, toggleFollow, upsertSellerProfile, getFollowers, getFollowing } from '../controllers/user.controller'
import { protect } from '../middleware/auth.middleware'

const router = Router()

router.get('/me', protect, getMe)
router.put('/me', protect, updateMe)
router.put('/me/seller-profile', protect, upsertSellerProfile)
router.get('/:username', getProfile)
router.get('/:username/followers', getFollowers)
router.get('/:username/following', getFollowing)
router.post('/:userId/follow', protect, toggleFollow)

export default router
