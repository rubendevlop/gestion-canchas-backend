import express from 'express';
import { createProduct, getProducts, updateProduct, deleteProduct } from '../controllers/productController.js';
import { verifyAuth, requireOwnerBillingAccess, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getProducts);
router.post('/', verifyAuth, requireRole(['superadmin', 'owner']), requireOwnerBillingAccess, createProduct);
router.put('/:id', verifyAuth, requireRole(['superadmin', 'owner']), requireOwnerBillingAccess, updateProduct);
router.delete('/:id', verifyAuth, requireRole(['superadmin', 'owner']), requireOwnerBillingAccess, deleteProduct);

export default router;
