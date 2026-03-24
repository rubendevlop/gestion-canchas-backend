import express from 'express';
import {
  createReservation,
  getMyReservations,
  getTakenSlots,
  cancelReservation,
  getComplexReservations,
} from '../controllers/reservationController.js';
import { verifyAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyAuth);

router.post('/', createReservation);
router.get('/mine', getMyReservations);          // reservas del usuario logueado
router.get('/taken', getTakenSlots);              // ?courtId=X&date=YYYY-MM-DD
router.patch('/:id/cancel', cancelReservation);   // cancelar reserva propia
router.get('/', getComplexReservations);           // para el owner (filtrar por complexId)

export default router;
