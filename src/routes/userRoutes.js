import express from 'express';
import { registerUser, loginUser, getCurrentUser, listUsers, updateUserRole } from '../controllers/userController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', verifyAuth, registerUser);
router.post('/login', verifyAuth, loginUser);
router.get('/me', verifyAuth, getCurrentUser);

// Solo superadmin
router.get('/', verifyAuth, requireRole(['superadmin']), listUsers);
router.patch('/:id/role', verifyAuth, requireRole(['superadmin']), updateUserRole);

export default router;
