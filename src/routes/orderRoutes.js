import express from 'express';
import {
  createOrder,
  getOrders,
  handleMercadoPagoOrderWebhook,
  processOrderPayment,
} from '../controllers/orderController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/webhook/mercadopago', handleMercadoPagoOrderWebhook);
router.get('/webhook/mercadopago', handleMercadoPagoOrderWebhook);

router.get('/', verifyAuth, requireRole(['client', 'owner', 'superadmin']), getOrders);
router.post('/', verifyAuth, requireRole(['client']), createOrder);
router.post('/:id/pay', verifyAuth, requireRole(['client']), processOrderPayment);

export default router;
