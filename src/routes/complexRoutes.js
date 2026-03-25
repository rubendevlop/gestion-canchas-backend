import express from 'express';
import { createComplex, getComplexes, getComplexById, getMyComplex, updateComplex } from '../controllers/complexController.js';
import { verifyAuth, requireOwnerBillingAccess, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Públicas
router.get('/', getComplexes);

// Privadas
// IMPORTANTE: /mine debe ir antes de /:id para no confundirse
router.get('/mine', verifyAuth, requireRole(['owner', 'superadmin']), requireOwnerBillingAccess, getMyComplex);
router.post('/', verifyAuth, requireRole(['superadmin', 'owner']), requireOwnerBillingAccess, createComplex);
router.put('/:id', verifyAuth, requireRole(['owner', 'superadmin']), requireOwnerBillingAccess, updateComplex);
router.get('/:id', getComplexById);

export default router;
