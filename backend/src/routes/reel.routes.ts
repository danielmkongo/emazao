import { Router } from 'express'
import { protect, optionalProtect } from '../middleware/auth.middleware'
import { getReels, getReel, getUserReels, createReel, deleteReel, recordReelView, incrementShareCount } from '../controllers/reel.controller'
import { getComments, getReplies, postComment, deleteComment } from '../controllers/comment.controller'

const router = Router()

router.get('/', optionalProtect, getReels)
router.get('/user/:userId', getUserReels)
router.post('/:id/view', optionalProtect, recordReelView)
router.post('/:id/share', optionalProtect, incrementShareCount)
// Optional auth so a signed-in viewer sees which comments they have liked.
router.get('/:id/comments', optionalProtect, getComments)
router.get('/:id/comments/:commentId/replies', optionalProtect, getReplies)
router.get('/:id', optionalProtect, getReel)

router.use(protect)
router.post('/', createReel)
router.delete('/:id', deleteReel)
router.post('/:id/comments', postComment)
router.delete('/:id/comments/:commentId', deleteComment)

export default router
