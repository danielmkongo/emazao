import { Router } from 'express'
import { getProducts, createProduct, getProduct, updateProduct, deleteProduct } from '../controllers/product.controller'
import { protect, optionalProtect } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'

const router = Router()

router.get('/', getProducts)
router.post('/', protect, requireRole('FARMER'), createProduct)
router.get('/:id', optionalProtect, getProduct)
router.put('/:id', protect, requireRole('FARMER', 'ADMIN'), updateProduct)
router.delete('/:id', protect, requireRole('FARMER', 'ADMIN'), deleteProduct)

export default router
