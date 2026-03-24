import express from 'express';
import { createReservation, getUserReservations } from '../controllers/reservationController.js';
import { verifyAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Todas las rutas de reservas requieren autenticación
router.use(verifyAuth);

router.post('/', createReservation);
router.get('/me', getUserReservations);

export default router;
