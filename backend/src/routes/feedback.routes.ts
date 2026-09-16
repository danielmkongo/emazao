import { Router } from 'express'
import { protect, optionalProtect } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import { submitFeedback, listFeedback, updateFeedback } from '../controllers/feedback.controller'

const router = Router()

// Open to signed-out visitors on purpose: someone blocked at signup is exactly
// who most needs to be able to tell us.
router.post('/', optionalProtect, submitFeedback)

router.get('/', protect, requireRole('ADMIN', 'SUPER_ADMIN'), listFeedback)
router.put('/:id', protect, requireRole('ADMIN', 'SUPER_ADMIN'), updateFeedback)

export default router
