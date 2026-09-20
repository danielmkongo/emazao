import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import {
  getConversations, getMessages, sendMessage, markRead, getUnreadCount, shareReel,
  recallMessage, editMessage, clearConversation,
} from '../controllers/message.controller'

const router = Router()

router.use(protect)
router.get('/', getConversations)
router.get('/unread-count', getUnreadCount)
router.get('/:conversationId', getMessages)
router.post('/', sendMessage)
router.post('/share-reel', shareReel)
router.put('/:conversationId/read', markRead)
// Under /message/ so a message id can never be read as a conversation id.
router.patch('/message/:id', editMessage)
router.post('/message/:id/recall', recallMessage)
router.delete('/:conversationId', clearConversation)

export default router
