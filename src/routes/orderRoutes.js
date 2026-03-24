import express from 'express';
import { createOrder, getOrders } from '../controllers/orderController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Todos los usuarios deben estar logueados para ver/crear órdenes
router.get('/', verifyAuth, requireRole(['client', 'owner', 'superadmin']), getOrders);
router.post('/', verifyAuth, requireRole(['client']), createOrder);

export default router;
