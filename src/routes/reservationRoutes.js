import express from 'express';
import {
  createReservation,
  getMyReservations,
  getTakenSlots,
  cancelReservation,
  getComplexReservations,
  confirmReservation,
} from '../controllers/reservationController.js';
import {
  attachDbUser,
  requireOwnerBillingAccess,
  requireRole,
  verifyAuth,
} from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyAuth);
router.use(attachDbUser);
router.use(requireOwnerBillingAccess);

router.post('/', createReservation);
router.get('/mine', getMyReservations);           // reservas del usuario logueado
router.get('/taken', getTakenSlots);               // ?courtId=X&date=YYYY-MM-DD
router.patch('/:id/cancel', cancelReservation);    // cancelar reserva propia
router.patch('/:id/confirm', requireRole(['owner', 'superadmin']), confirmReservation);  // confirmar reserva (owner)
router.get('/', requireRole(['owner', 'superadmin']), getComplexReservations);            // para el owner (?complexId=X)

export default router;
