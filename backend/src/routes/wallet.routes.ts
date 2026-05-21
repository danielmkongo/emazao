import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { getWallet, getTransactions, requestWithdrawal } from '../controllers/wallet.controller'

const router = Router()

router.use(protect)
router.get('/', getWallet)
router.get('/transactions', getTransactions)
router.post('/withdraw', requestWithdrawal)

export default router
