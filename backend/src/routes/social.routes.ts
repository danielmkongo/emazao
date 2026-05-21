import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { toggleLike, toggleSave, getSaved } from '../controllers/social.controller'

const router = Router()

router.use(protect)
router.post('/like', toggleLike)
router.post('/save', toggleSave)
router.get('/saved', getSaved)

export default router
