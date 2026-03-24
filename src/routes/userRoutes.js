import express from 'express';
import { registerUser, loginUser, getCurrentUser } from '../controllers/userController.js';
import { verifyAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', verifyAuth, registerUser);
router.post('/login', verifyAuth, loginUser);
router.get('/me', verifyAuth, getCurrentUser);

export default router;
