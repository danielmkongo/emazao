import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import { listUsers, verifyUser, suspendUser, listDisputes, resolveDispute, getPlatformAnalytics } from '../controllers/admin.controller'

const router = Router()

router.use(protect)
router.use(requireRole('ADMIN', 'SUPER_ADMIN'))

router.get('/users', listUsers)
router.put('/users/:id/verify', verifyUser)
router.put('/users/:id/suspend', suspendUser)
router.get('/disputes', listDisputes)
router.put('/disputes/:id/resolve', resolveDispute)
router.get('/analytics/platform', getPlatformAnalytics)

export default router
