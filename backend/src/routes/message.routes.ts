import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { getConversations, getMessages, sendMessage, markRead } from '../controllers/message.controller'

const router = Router()

router.use(protect)
router.get('/', getConversations)
router.get('/:conversationId', getMessages)
router.post('/', sendMessage)
router.put('/:conversationId/read', markRead)

export default router
