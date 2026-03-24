import express from 'express';
import { createComplex, getComplexes, getComplexById } from '../controllers/complexController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getComplexes);
router.get('/:id', getComplexById);
router.post('/', verifyAuth, requireRole(['superadmin', 'owner']), createComplex);

export default router;
