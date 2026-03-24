import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/stats', verifyAuth, requireRole(['owner', 'superadmin']), getDashboardStats);

export default router;
