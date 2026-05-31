import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import {
  getContentInsights, getCreatorDashboard, getConfig, updateConfig, getAdminOverview,
} from '../controllers/recommendation.controller'

const router = Router()

// Creator analytics — "why is my content promoted/suppressed"
router.get('/content/:contentId/insights', protect, getContentInsights)
router.get('/dashboard', protect, getCreatorDashboard)

// Ranking config (read public-ish for transparency, write admin-only)
router.get('/config', protect, getConfig)
router.put('/config', protect, requireRole('ADMIN', 'SUPER_ADMIN'), updateConfig)
router.get('/admin/overview', protect, requireRole('ADMIN', 'SUPER_ADMIN'), getAdminOverview)

export default router
