import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { ingestEvents } from '../controllers/event.controller'

const router = Router()
router.post('/', protect, ingestEvents)
export default router
