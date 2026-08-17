import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import { listUsers, verifyUser, suspendUser, unsuspendUser, listDisputes, resolveDispute, getPlatformAnalytics } from '../controllers/admin.controller'
import {
  listFlags, reviewFlag, listPendingVerifications,
  getVerificationDocuments, decideVerification,
} from '../controllers/compliance.controller'

const router = Router()

router.use(protect)
router.use(requireRole('ADMIN', 'SUPER_ADMIN'))

router.get('/users', listUsers)
router.put('/users/:id/verify', verifyUser)
router.put('/users/:id/suspend', suspendUser)
router.put('/users/:id/unsuspend', unsuspendUser)
router.get('/disputes', listDisputes)
router.put('/disputes/:id/resolve', resolveDispute)
router.get('/analytics/platform', getPlatformAnalytics)

// AML / KYC review queue
router.get('/compliance/flags', listFlags)
router.put('/compliance/flags/:id', reviewFlag)
router.get('/compliance/verifications', listPendingVerifications)
router.get('/compliance/verifications/:userId/documents', getVerificationDocuments)
router.put('/compliance/verifications/:userId', decideVerification)

export default router
