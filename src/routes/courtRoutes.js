import express from 'express';
import {
  getCourts, getCourtById, createCourt, updateCourt, deleteCourt
} from '../controllers/courtController.js';
import { verifyAuth, requireOwnerBillingAccess, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Públicas (para portal de clientes)
router.get('/', getCourts);
router.get('/:id', getCourtById);

// Privadas (solo owner/superadmin)
router.post('/', verifyAuth, requireRole(['owner', 'superadmin']), requireOwnerBillingAccess, createCourt);
router.put('/:id', verifyAuth, requireRole(['owner', 'superadmin']), requireOwnerBillingAccess, updateCourt);
router.delete('/:id', verifyAuth, requireRole(['owner', 'superadmin']), requireOwnerBillingAccess, deleteCourt);

export default router;
