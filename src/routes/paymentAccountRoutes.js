import express from 'express';
import {
  getCurrentOwnerPaymentAccount,
  updateCurrentOwnerPaymentAccount,
} from '../controllers/paymentAccountController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/current', verifyAuth, requireRole(['owner']), getCurrentOwnerPaymentAccount);
router.put('/current', verifyAuth, requireRole(['owner']), updateCurrentOwnerPaymentAccount);

export default router;
