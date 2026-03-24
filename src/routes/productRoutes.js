import express from 'express';
import { createProduct, getProducts, updateProduct, deleteProduct } from '../controllers/productController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getProducts);
router.post('/', verifyAuth, requireRole(['superadmin', 'owner']), createProduct);
router.put('/:id', verifyAuth, requireRole(['superadmin', 'owner']), updateProduct);
router.delete('/:id', verifyAuth, requireRole(['superadmin', 'owner']), deleteProduct);

export default router;
