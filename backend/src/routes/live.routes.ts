import { Router } from 'express'
import { getLiveSessions } from '../controllers/live.controller'

const router = Router()
router.get('/', getLiveSessions)
export default router
