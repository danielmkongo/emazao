import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { getNotifications, markAllRead, markOneRead } from '../controllers/notification.controller'

const router = Router()

router.use(protect)
router.get('/', getNotifications)
router.put('/read-all', markAllRead)
router.put('/:id/read', markOneRead)

export default router
