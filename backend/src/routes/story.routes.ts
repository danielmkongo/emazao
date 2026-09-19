import { Router } from 'express'
import { protect, optionalProtect } from '../middleware/auth.middleware'
import {
  getStoryFeed, getUserStories, createStory, viewStory, getStoryViewers, replyToStory, deleteStory,
} from '../controllers/story.controller'

const router = Router()

// Public so a profile's story ring works for signed-out visitors too.
router.get('/user/:userId', optionalProtect, getUserStories)

router.use(protect)
router.get('/feed', getStoryFeed)
router.post('/', createStory)
router.post('/:id/view', viewStory)
router.get('/:id/viewers', getStoryViewers)
router.post('/:id/reply', replyToStory)
router.delete('/:id', deleteStory)

export default router
