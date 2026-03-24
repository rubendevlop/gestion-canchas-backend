import express from 'express';
import { syncUser, getCurrentUser } from '../controllers/userController.js';
import { verifyAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/sync', verifyAuth, syncUser);
router.get('/me', verifyAuth, getCurrentUser);

export default router;
