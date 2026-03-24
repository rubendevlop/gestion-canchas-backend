import express from 'express';
import {
  createReservation,
  getMyReservations,
  getTakenSlots,
  cancelReservation,
  getComplexReservations,
  confirmReservation,
} from '../controllers/reservationController.js';
import { verifyAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyAuth);

router.post('/', createReservation);
router.get('/mine', getMyReservations);           // reservas del usuario logueado
router.get('/taken', getTakenSlots);               // ?courtId=X&date=YYYY-MM-DD
router.patch('/:id/cancel', cancelReservation);    // cancelar reserva propia
router.patch('/:id/confirm', confirmReservation);  // confirmar reserva (owner)
router.get('/', getComplexReservations);            // para el owner (?complexId=X)

export default router;
