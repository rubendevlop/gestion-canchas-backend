import express from 'express';
import {
  createReservation,
  cancelReservation,
  confirmReservation,
  getComplexReservations,
  getMyReservations,
  getTakenSlots,
  handleMercadoPagoReservationWebhook,
  processReservationPayment,
} from '../controllers/reservationController.js';
import {
  attachDbUser,
  requireOwnerBillingAccess,
  requireRole,
  verifyAuth,
} from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/webhook/mercadopago', handleMercadoPagoReservationWebhook);
router.get('/webhook/mercadopago', handleMercadoPagoReservationWebhook);

router.use(verifyAuth);
router.use(attachDbUser);
router.use(requireOwnerBillingAccess);

router.post('/', createReservation);
router.get('/mine', getMyReservations);           // reservas del usuario logueado
router.get('/taken', getTakenSlots);               // ?courtId=X&date=YYYY-MM-DD
router.post('/:id/pay', requireRole(['client']), processReservationPayment);
router.patch('/:id/cancel', cancelReservation);    // cancelar reserva propia
router.patch('/:id/confirm', requireRole(['owner', 'superadmin']), confirmReservation);  // confirmar reserva (owner)
router.get('/', requireRole(['owner', 'superadmin']), getComplexReservations);            // para el owner (?complexId=X)

export default router;
