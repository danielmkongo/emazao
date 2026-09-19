import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { toggleLike, toggleSave, getSaved, getLiked } from '../controllers/social.controller'

const router = Router()

router.use(protect)
router.post('/like', toggleLike)
router.post('/save', toggleSave)
// Both private to the signed-in user, as on Instagram and TikTok.
router.get('/saved', getSaved)
router.get('/liked', getLiked)

export default router
