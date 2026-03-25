import Complex from '../models/Complex.js';
import Court from '../models/Court.js';
import Reservation from '../models/Reservation.js';
import { getOwnerPaymentProvider } from '../utils/paymentAccounts.js';
import {
  createAutomaticMercadoPagoOrder,
  extractMercadoPagoOrderId,
  getMercadoPagoOrder,
  getMercadoPagoOrderSnapshot,
  isApprovedMercadoPagoOrder,
  isCancelledMercadoPagoOrder,
  isFailedMercadoPagoOrder,
  isPendingMercadoPagoOrder,
  validateMercadoPagoWebhookSignature,
} from '../utils/mercadoPago.js';
import { normalizeBookingHours } from '../utils/bookingHours.js';
import { assertComplexClientAccess } from '../utils/ownerBilling.js';

async function ensureOwnerOwnsComplex(complexId, dbUser) {
  if (dbUser.role === 'superadmin') return;

  const complex = await Complex.findById(complexId).select('ownerId');
  if (!complex) {
    const error = new Error('Complejo no encontrado');
    error.status = 404;
    throw error;
  }

  if (complex.ownerId.toString() !== dbUser._id.toString()) {
    const error = new Error('No autorizado para operar sobre este complejo.');
    error.status = 403;
    throw error;
  }
}

function buildReservationExternalReference(reservationId) {
  return `reservation:${reservationId}`;
}

function buildReservationDescription(reservation, court, complex) {
  return `Reserva ${complex?.name || 'Clubes Tucumán'} - ${court?.name || 'Cancha'} - ${reservation.startTime}`;
}

function serializeReservationPaymentSession(
  reservation,
  user,
  court,
  complex,
  paymentProvider = {},
) {
  return {
    provider: 'mercadopago',
    checkoutMode: 'orders',
    providerConfigured: paymentProvider.configured === true,
    publicKey: paymentProvider.publicKey || '',
    reservationId: reservation._id,
    amount: reservation.totalPrice,
    currency: 'ARS',
    description: buildReservationDescription(reservation, court, complex),
    payer: {
      email: user.email,
    },
    providerAccount: paymentProvider.accountSummary
      ? {
          collectorNickname: paymentProvider.accountSummary.collectorNickname,
          collectorEmail: paymentProvider.accountSummary.collectorEmail,
          mode: paymentProvider.accountSummary.mode,
        }
      : null,
  };
}

function applySnapshotToReservation(reservation, snapshot) {
  reservation.mercadoPagoOrderId = snapshot.orderId;
  reservation.mercadoPagoOrderStatus = snapshot.orderStatus;
  reservation.mercadoPagoOrderStatusDetail = snapshot.orderStatusDetail;
  reservation.mercadoPagoPaymentId = snapshot.paymentId;
  reservation.mercadoPagoStatus = snapshot.paymentStatus;
  reservation.mercadoPagoStatusDetail = snapshot.paymentStatusDetail;
  reservation.mercadoPagoPaymentMethodId = snapshot.paymentMethodId;
  reservation.mercadoPagoPaymentMethodType = snapshot.paymentMethodType;
}

async function syncReservationFromMercadoPagoOrder(reservation, mercadoPagoOrder) {
  const snapshot = getMercadoPagoOrderSnapshot(mercadoPagoOrder);
  applySnapshotToReservation(reservation, snapshot);

  if (isApprovedMercadoPagoOrder(mercadoPagoOrder)) {
    reservation.paymentStatus = 'PAID';
    reservation.paidAt = snapshot.approvedAt ? new Date(snapshot.approvedAt) : new Date();
    if (reservation.status === 'PENDING') {
      reservation.status = 'CONFIRMED';
    }
  } else if (isPendingMercadoPagoOrder(mercadoPagoOrder)) {
    reservation.paymentStatus = 'UNPAID';
  } else if (isCancelledMercadoPagoOrder(mercadoPagoOrder) || isFailedMercadoPagoOrder(mercadoPagoOrder)) {
    reservation.paymentStatus = 'UNPAID';
  }

  await reservation.save();
  return reservation;
}

async function loadReservationForPayment(reservationId, dbUser) {
  const reservation = await Reservation.findById(reservationId)
    .populate('court', 'name sport complexId')
    .populate('complexId', 'name ownerId');

  if (!reservation) {
    const error = new Error('Reserva no encontrada.');
    error.status = 404;
    throw error;
  }

  if (dbUser.role === 'client' && reservation.user.toString() !== dbUser._id.toString()) {
    const error = new Error('No autorizado para pagar esta reserva.');
    error.status = 403;
    throw error;
  }

  if (dbUser.role === 'owner') {
    await ensureOwnerOwnsComplex(reservation.complexId?._id || reservation.complexId, dbUser);
  }

  return reservation;
}

export const createReservation = async (req, res) => {
  try {
    const { courtId, date, startTime } = req.body;
    const user = req.dbUser;

    if (!courtId || !date || !startTime) {
      return res.status(400).json({ message: 'courtId, date y startTime son requeridos.' });
    }

    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({ message: 'Cancha no encontrada' });
    }

    if (user.role === 'owner') {
      await ensureOwnerOwnsComplex(court.complexId, user);
    } else {
      await assertComplexClientAccess(court.complexId, { createBillingIfMissing: true });
    }

    const dateObj = new Date(date);
    const clash = await Reservation.findOne({
      court: courtId,
      date: dateObj,
      startTime,
      status: { $ne: 'CANCELLED' },
    });

    if (clash) {
      return res.status(409).json({ message: 'El horario ya esta reservado.' });
    }

    const availableBookingHours = normalizeBookingHours(court.bookingHours);
    if (!availableBookingHours.includes(startTime)) {
      return res.status(409).json({ message: 'Ese horario no esta habilitado para esta cancha.' });
    }

    const [hour, minute] = startTime.split(':').map(Number);
    const endTime = `${String(hour + 1).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const reservation = new Reservation({
      user: user._id,
      court: court._id,
      complexId: court.complexId,
      date: dateObj,
      startTime,
      endTime,
      totalPrice: court.pricePerHour,
      status: 'PENDING',
      externalReference: `reservation:draft:${user._id}:${Date.now()}`,
    });

    reservation.externalReference = buildReservationExternalReference(reservation._id.toString());

    const saved = await reservation.save();
    let complex = null;
    let paymentProvider = { configured: false, publicKey: '', accountSummary: null };

    try {
      complex = await Complex.findById(court.complexId).select('name ownerId');
      paymentProvider = complex?.ownerId
        ? await getOwnerPaymentProvider(complex.ownerId)
        : paymentProvider;
    } catch (paymentSetupError) {
      console.error('No se pudo resolver la cuenta de cobro al crear la reserva:', paymentSetupError.message);
    }

    res.status(201).json({
      reservation: saved,
      providerConfigured: paymentProvider.configured === true,
      paymentSession: serializeReservationPaymentSession(saved, user, court, complex, paymentProvider),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Error creando la reserva',
      error: error.message,
    });
  }
};

export const getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({ user: req.dbUser._id })
      .populate('court', 'name sport pricePerHour complexId')
      .populate('complexId', 'name')
      .sort({ date: -1 });

    const normalized = reservations.map((reservation) => ({
      ...reservation.toObject(),
      status: reservation.status.toLowerCase(),
    }));

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo reservas', error: error.message });
  }
};

export const getTakenSlots = async (req, res) => {
  try {
    const { courtId, date } = req.query;
    if (!courtId || !date) {
      return res.status(400).json({ message: 'courtId y date son requeridos.' });
    }

    const reservations = await Reservation.find({
      court: courtId,
      date: new Date(date),
      status: { $ne: 'CANCELLED' },
    }).select('startTime');

    if (req.dbUser.role === 'client') {
      const court = await Court.findById(courtId).select('complexId');
      if (!court) {
        return res.status(404).json({ message: 'Cancha no encontrada' });
      }
      await assertComplexClientAccess(court.complexId, { createBillingIfMissing: true });
    }

    res.json({ takenHours: reservations.map((reservation) => reservation.startTime) });
  } catch (error) {
    res.status(error.status || 500).json({ message: 'Error obteniendo slots', error: error.message });
  }
};

export const cancelReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    if (
      reservation.user.toString() !== req.dbUser._id.toString() &&
      req.dbUser.role !== 'superadmin'
    ) {
      return res.status(403).json({ message: 'No autorizado para cancelar esta reserva.' });
    }

    if (reservation.status === 'CANCELLED') {
      return res.status(400).json({ message: 'La reserva ya esta cancelada.' });
    }

    reservation.status = 'CANCELLED';
    await reservation.save();
    res.json({ message: 'Reserva cancelada', reservation });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelando la reserva', error: error.message });
  }
};

export const confirmReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    await ensureOwnerOwnsComplex(reservation.complexId, req.dbUser);

    if (reservation.status === 'CANCELLED') {
      return res.status(400).json({ message: 'No se puede confirmar una reserva cancelada.' });
    }

    reservation.status = 'CONFIRMED';
    await reservation.save();
    res.json({ message: 'Reserva confirmada', reservation });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error confirmando la reserva' });
  }
};

export const processReservationPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { formData, additionalData } = req.body;

    if (!formData?.token) {
      return res.status(400).json({ message: 'formData es requerido para procesar el pago.' });
    }

    const reservation = await loadReservationForPayment(id, req.dbUser);
    await assertComplexClientAccess(reservation.complexId?._id || reservation.complexId, {
      createBillingIfMissing: true,
    });

    const paymentProvider = await getOwnerPaymentProvider(reservation.complexId.ownerId);
    if (!paymentProvider.configured || paymentProvider.accountSummary?.reservationsEnabled === false) {
      return res.status(409).json({
        message: 'El complejo todavia no tiene cobros online configurados para reservas.',
      });
    }

    const mercadoPagoOrder = await createAutomaticMercadoPagoOrder({
      externalReference: reservation.externalReference,
      totalAmount: reservation.totalPrice,
      currency: 'ARS',
      description: buildReservationDescription(reservation, reservation.court, reservation.complexId),
      payer: {
        email: formData?.payer?.email || req.dbUser.email,
        identification: formData?.payer?.identification || undefined,
      },
      formData,
      additionalData,
      notificationPath: '/api/reservations/webhook/mercadopago',
      accessToken: paymentProvider.accessToken,
    });

    const syncedReservation = await syncReservationFromMercadoPagoOrder(reservation, mercadoPagoOrder);

    res.json({
      message: 'Pago de la reserva procesado correctamente.',
      reservation: syncedReservation,
      paymentSession: serializeReservationPaymentSession(
        syncedReservation,
        req.dbUser,
        reservation.court,
        reservation.complexId,
        paymentProvider,
      ),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Error procesando el pago de la reserva.',
      error: error.message,
    });
  }
};

export const handleMercadoPagoReservationWebhook = async (req, res) => {
  try {
    if (!validateMercadoPagoWebhookSignature(req)) {
      return res.status(401).json({ received: false, error: 'Firma de webhook invalida.' });
    }

    const orderId = extractMercadoPagoOrderId({
      ...req.body,
      query: req.query,
    });

    if (!orderId) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const reservation = await Reservation.findOne({ mercadoPagoOrderId: String(orderId) })
      .populate('complexId', 'ownerId')
      .populate('court', 'name');

    if (!reservation) {
      return res.status(200).json({ received: true, ignored: true, reason: 'reservation_not_found' });
    }

    const paymentProvider = await getOwnerPaymentProvider(reservation.complexId?.ownerId);
    if (!paymentProvider.configured) {
      return res.status(200).json({ received: true, ignored: true, reason: 'payment_account_not_configured' });
    }

    const mercadoPagoOrder = await getMercadoPagoOrder(orderId, paymentProvider.accessToken);
    const syncedReservation = await syncReservationFromMercadoPagoOrder(reservation, mercadoPagoOrder);

    res.status(200).json({ received: true, reservation: syncedReservation });
  } catch (error) {
    res.status(200).json({
      received: true,
      error: error.message,
    });
  }
};

export const getComplexReservations = async (req, res) => {
  try {
    const { complexId, date, status, paymentStatus, userId } = req.query;
    const filter = {};

    if (complexId) {
      await ensureOwnerOwnsComplex(complexId, req.dbUser);
      filter.complexId = complexId;
    } else if (req.dbUser.role === 'owner') {
      const ownedComplex = await Complex.findOne({ ownerId: req.dbUser._id }).select('_id');
      if (!ownedComplex) {
        return res.status(404).json({ message: 'No tenes ningun complejo configurado.' });
      }
      filter.complexId = ownedComplex._id;
    }

    if (date) {
      filter.date = new Date(date);
    }

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (userId) {
      filter.user = userId;
    }

    const reservations = await Reservation.find(filter)
      .populate('court', 'name sport')
      .populate('complexId', 'name')
      .populate('user', 'displayName email photoURL createdAt')
      .sort({ date: 1, startTime: 1 });

    res.json(reservations);
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Error obteniendo reservas del complejo',
      error: error.message,
    });
  }
};
