import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import { listUsers, verifyUser, suspendUser, unsuspendUser, listDisputes, resolveDispute, getPlatformAnalytics } from '../controllers/admin.controller'
import {
  listFlags, reviewFlag, listPendingVerifications,
  getVerificationDocuments, decideVerification,
} from '../controllers/compliance.controller'
import {
  getOverview, listTransactions, getSettings, updateSettings,
  issuePasswordReset, listAuditLogs,
} from '../controllers/adminOps.controller'

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

// Operations dashboard
router.get('/overview', getOverview)
router.get('/transactions', listTransactions)

// Account support: hand the user a fresh reset link when the email never arrives.
router.post('/users/:id/password-reset', issuePasswordReset)

// Platform settings. SUPER_ADMIN only — commission and maintenance mode affect
// every user and every future payout, which is a wider blast radius than the
// per-account moderation the rest of this router does.
router.get('/settings', getSettings)
router.put('/settings', requireRole('SUPER_ADMIN'), updateSettings)

// Read-only audit trail. There is no write route by design: a log its own
// subjects can edit is not evidence.
router.get('/audit', listAuditLogs)

// AML / KYC review queue
router.get('/compliance/flags', listFlags)
router.put('/compliance/flags/:id', reviewFlag)
router.get('/compliance/verifications', listPendingVerifications)
router.get('/compliance/verifications/:userId/documents', getVerificationDocuments)
router.put('/compliance/verifications/:userId', decideVerification)

export default router
