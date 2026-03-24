import express from 'express';
import { createProduct, getProducts } from '../controllers/productController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getProducts);
router.post('/', verifyAuth, requireRole(['superadmin', 'owner']), createProduct);

export default router;
