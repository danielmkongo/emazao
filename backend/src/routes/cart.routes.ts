import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import {
  getCart, addToCart, updateCartItem, removeFromCart, clearCart, checkout, getCheckout,
} from '../controllers/cart.controller'

const router = Router()

router.use(protect)
router.get('/', getCart)
router.delete('/', clearCart)
router.post('/items', addToCart)
router.put('/items/:productId', updateCartItem)
router.delete('/items/:productId', removeFromCart)
router.post('/checkout', checkout)
router.get('/checkout/:id', getCheckout)

export default router
