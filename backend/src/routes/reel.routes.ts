import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { getReels, getUserReels, createReel, deleteReel, recordReelView } from '../controllers/reel.controller'

const router = Router()

router.get('/', getReels)
router.get('/user/:userId', getUserReels)
router.post('/:id/view', recordReelView)

router.use(protect)
router.post('/', createReel)
router.delete('/:id', deleteReel)

export default router
