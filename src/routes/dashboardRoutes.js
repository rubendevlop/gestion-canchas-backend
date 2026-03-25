import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { verifyAuth, requireOwnerBillingAccess, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/stats', verifyAuth, requireRole(['owner', 'superadmin']), requireOwnerBillingAccess, getDashboardStats);

export default router;
