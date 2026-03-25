import express from 'express';
import {
  getAdminOwnerBillingInvoices,
  createOwnerBillingCheckout,
  getCurrentOwnerBilling,
  getOwnerBillingInvoices,
  handleMercadoPagoWebhook,
} from '../controllers/ownerBillingController.js';
import { requireRole, verifyAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/webhook/mercadopago', handleMercadoPagoWebhook);
router.get('/webhook/mercadopago', handleMercadoPagoWebhook);

router.get('/admin/invoices', verifyAuth, requireRole(['superadmin']), getAdminOwnerBillingInvoices);
router.get('/current', verifyAuth, requireRole(['owner']), getCurrentOwnerBilling);
router.post('/checkout', verifyAuth, requireRole(['owner']), createOwnerBillingCheckout);
router.get('/history', verifyAuth, requireRole(['owner']), getOwnerBillingInvoices);

export default router;
