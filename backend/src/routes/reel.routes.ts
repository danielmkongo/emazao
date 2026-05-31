import { Router } from 'express'
import { protect, optionalProtect } from '../middleware/auth.middleware'
import { getReels, getUserReels, createReel, deleteReel, recordReelView, getComments, postComment, incrementShareCount } from '../controllers/reel.controller'

const router = Router()

router.get('/', optionalProtect, getReels)
router.get('/user/:userId', getUserReels)
router.post('/:id/view', optionalProtect, recordReelView)
router.post('/:id/share', optionalProtect, incrementShareCount)
router.get('/:id/comments', getComments)

router.use(protect)
router.post('/', createReel)
router.delete('/:id', deleteReel)
router.post('/:id/comments', postComment)

export default router
