import express from 'express';
import { signCloudinaryUpload } from '../controllers/mediaController.js';
import { requireOwnerBillingAccess, requireRole, verifyAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post(
  '/sign-upload',
  verifyAuth,
  requireRole(['owner', 'superadmin']),
  requireOwnerBillingAccess,
  signCloudinaryUpload,
);

export default router;
