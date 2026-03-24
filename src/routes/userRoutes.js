import express from 'express';
import {
  registerUser, loginUser, getCurrentUser,
  listUsers, updateUserRole, approveOwner, rejectOwner
} from '../controllers/userController.js';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', verifyAuth, registerUser);
router.post('/login',    verifyAuth, loginUser);
router.get('/me',        verifyAuth, getCurrentUser);

// Solo superadmin
router.get('/',                  verifyAuth, requireRole(['superadmin']), listUsers);
router.patch('/:id/role',        verifyAuth, requireRole(['superadmin']), updateUserRole);
router.patch('/:id/approve',     verifyAuth, requireRole(['superadmin']), approveOwner);
router.patch('/:id/reject',      verifyAuth, requireRole(['superadmin']), rejectOwner);

export default router;
