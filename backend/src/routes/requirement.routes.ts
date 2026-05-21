import { Router } from 'express'
import {
  getRequirements, createRequirement, getRequirement, submitBid, updateBidStatus, getMyBids
} from '../controllers/requirement.controller'
import { protect } from '../middleware/auth.middleware'

const router = Router()

router.get('/', getRequirements)
router.post('/', protect, createRequirement)
router.get('/my/bids', protect, getMyBids)
router.get('/:id', getRequirement)
router.post('/:id/bids', protect, submitBid)
router.put('/bids/:bidId', protect, updateBidStatus)

export default router
