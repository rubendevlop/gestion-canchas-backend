import express from 'express';
import {
  deleteCurrentOwnerPaymentAccount,
  getCurrentOwnerPaymentAccount,
  getMercadoPagoConnectUrl,
  handleMercadoPagoOAuthCallback,
  updateCurrentOwnerPaymentAccount,
} from '../controllers/paymentAccountController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/oauth/callback', handleMercadoPagoOAuthCallback);
router.get('/oauth/connect-url', verifyAuth, requireRole(['owner']), getMercadoPagoConnectUrl);
router.get('/current', verifyAuth, requireRole(['owner']), getCurrentOwnerPaymentAccount);
router.put('/current', verifyAuth, requireRole(['owner']), updateCurrentOwnerPaymentAccount);
router.delete('/current', verifyAuth, requireRole(['owner']), deleteCurrentOwnerPaymentAccount);

export default router;
