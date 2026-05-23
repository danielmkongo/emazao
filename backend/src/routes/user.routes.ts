import { Router } from 'express'
import { listUsers, getMe, updateMe, getProfile, toggleFollow, upsertSellerProfile, getFollowers, getFollowing, getUserById } from '../controllers/user.controller'
import { protect, optionalProtect } from '../middleware/auth.middleware'

const router = Router()

router.get('/', listUsers)
router.get('/me', protect, getMe)
router.put('/me', protect, updateMe)
router.put('/me/seller-profile', protect, upsertSellerProfile)
router.get('/by-id/:userId', protect, getUserById)
router.get('/:username', optionalProtect, getProfile)
router.get('/:username/followers', getFollowers)
router.get('/:username/following', getFollowing)
router.post('/:userId/follow', protect, toggleFollow)

export default router
