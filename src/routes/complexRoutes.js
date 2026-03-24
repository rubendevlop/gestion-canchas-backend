import express from 'express';
import { createComplex, getComplexes, getComplexById, getMyComplex, updateComplex } from '../controllers/complexController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Públicas
router.get('/', getComplexes);
router.get('/:id', getComplexById);

// Privadas
// IMPORTANTE: /mine debe ir antes de /:id para no confundirse
router.get('/mine', verifyAuth, requireRole(['owner', 'superadmin']), getMyComplex);
router.post('/', verifyAuth, requireRole(['superadmin', 'owner']), createComplex);
router.put('/:id', verifyAuth, requireRole(['owner', 'superadmin']), updateComplex);

export default router;
