import Complex from '../models/Complex.js';
import Court from '../models/Court.js';
import Reservation from '../models/Reservation.js';
import {
  sendReservationOwnerPaidEmail,
  sendReservationPaidEmail,
} from '../utils/emailNotifications.js';
import { getOwnerPaymentProvider } from '../utils/paymentAccounts.js';
import {
  buildWebhookUrl,
  createCheckoutPreference,
  createAutomaticMercadoPagoOrder,
  createMercadoPagoOrderRefund,
  createMercadoPagoPaymentRefund,
  extractMercadoPagoPaymentId,
  extractMercadoPagoOrderId,
  getFrontendUrl,
  getMercadoPagoOrder,
  getMercadoPagoOrderRefundSnapshot,
  getMercadoPagoOrderSnapshot,
  getMercadoPagoPayment,
  getMercadoPagoPaymentSnapshot,
  isApprovedMercadoPagoOrder,
  isApprovedMercadoPagoPayment,
  isCancelledMercadoPagoOrder,
  isCancelledMercadoPagoPayment,
  isFailedMercadoPagoOrder,
  isFailedMercadoPagoPayment,
  isPendingMercadoPagoOrder,
  isPendingMercadoPagoPayment,
  isPartiallyRefundedMercadoPagoOrder,
  isRefundedMercadoPagoPayment,
  isRefundedMercadoPagoOrder,
  resolveMercadoPagoPayerEmail,
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
  return `reservation-${reservationId}`;
}

function buildReservationReturnUrl(reservation, complexId, result = 'pending') {
  const url = new URL('/portal/pago/mercadopago', `${getFrontendUrl()}/`);
  url.searchParams.set('entity', 'reservation');
  url.searchParams.set('id', String(reservation._id));
  url.searchParams.set('complexId', String(complexId || reservation.complexId || ''));
  url.searchParams.set('result', String(result || 'pending'));
  return url.toString();
}

function buildReservationNotificationUrl(reservation, complex) {
  const baseUrl = buildWebhookUrl('/api/reservations/webhook/mercadopago');
  if (!baseUrl) {
    return '';
  }

  const url = new URL(baseUrl);
  url.searchParams.set('reservationId', String(reservation._id));

  if (complex?.ownerId) {
    url.searchParams.set('ownerId', String(complex.ownerId));
  }

  return url.toString();
}

function buildReservationDescription(reservation, court, complex) {
  return `Reserva ${complex?.name || 'Clubes Tucumán'} - ${court?.name || 'Cancha'} - ${reservation.startTime}`;
}

function normalizeReservationPaymentMethod(value, fallback = '') {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ONLINE' || normalized === 'ON_SITE') {
    return normalized;
  }

  return fallback;
}

function resolveReservationPaymentMethod(reservation = {}) {
  const explicitMethod = normalizeReservationPaymentMethod(reservation?.paymentMethod);
  if (explicitMethod) {
    return explicitMethod;
  }

  if (
    reservation?.mercadoPagoPreferenceId ||
    reservation?.mercadoPagoOrderId ||
    reservation?.mercadoPagoPaymentId ||
    reservation?.mercadoPagoStatus ||
    reservation?.mercadoPagoPaymentMethodId
  ) {
    return 'ONLINE';
  }

  return 'ON_SITE';
}

function buildReservationPaymentOptions(paymentProvider = {}) {
  const onlineEnabled =
    paymentProvider.configured === true &&
    paymentProvider.accountSummary?.reservationsEnabled !== false;

  return {
    defaultMethod: onlineEnabled ? 'ONLINE' : 'ON_SITE',
    onSiteEnabled: true,
    onlineEnabled,
    provider: onlineEnabled ? 'mercadopago' : '',
    providerMode: onlineEnabled ? paymentProvider.accountSummary?.mode || '' : '',
  };
}

function resolveRequestedReservationPaymentMethod(value, { onlineEnabled = false, role = '' } = {}) {
  const explicitMethod = normalizeReservationPaymentMethod(value);
  if (explicitMethod) {
    return explicitMethod;
  }

  if (String(role || '').toLowerCase() === 'client' && onlineEnabled) {
    return 'ONLINE';
  }

  return 'ON_SITE';
}

function serializeReservationRecord(reservation) {
  const raw = typeof reservation?.toObject === 'function' ? reservation.toObject() : reservation;
  return {
    ...raw,
    paymentMethod: resolveReservationPaymentMethod(raw),
  };
}

function serializeReservationPaymentSession(
  reservation,
  user,
  court,
  complex,
  paymentProvider = {},
  checkout = {},
) {
  const payer = resolveMercadoPagoPayerEmail({
    fallbackEmail: user.email,
    providerMode: paymentProvider.accountSummary?.mode,
  });

  return {
    provider: 'mercadopago',
    checkoutMode: 'checkout_pro',
    providerConfigured: paymentProvider.configured === true,
    publicKey: paymentProvider.publicKey || '',
    reservationId: reservation._id,
    paymentMethod: resolveReservationPaymentMethod(reservation),
    preferenceId: checkout.preferenceId || reservation.mercadoPagoPreferenceId || '',
    checkoutUrl: checkout.checkoutUrl || '',
    amount: reservation.totalPrice,
    currency: 'ARS',
    description: buildReservationDescription(reservation, court, complex),
    availableMethods: buildReservationPaymentOptions(paymentProvider),
    payer: {
      email: payer.email,
      usesConfiguredTestEmail: payer.usesConfiguredTestEmail,
      requiresTestUser: payer.requiresTestUser,
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
  reservation.paymentMethod = 'ONLINE';
  reservation.mercadoPagoOrderId = snapshot.orderId;
  reservation.mercadoPagoOrderStatus = snapshot.orderStatus;
  reservation.mercadoPagoOrderStatusDetail = snapshot.orderStatusDetail;
  reservation.mercadoPagoPaymentId = snapshot.paymentId;
  reservation.mercadoPagoStatus = snapshot.paymentStatus;
  reservation.mercadoPagoStatusDetail = snapshot.paymentStatusDetail;
  reservation.mercadoPagoPaymentMethodId = snapshot.paymentMethodId;
  reservation.mercadoPagoPaymentMethodType = snapshot.paymentMethodType;
}

function applyPaymentSnapshotToReservation(reservation, snapshot) {
  reservation.paymentMethod = 'ONLINE';
  reservation.mercadoPagoPreferenceId = snapshot.preferenceId || reservation.mercadoPagoPreferenceId || '';
  reservation.mercadoPagoOrderId = snapshot.paymentOrderId || reservation.mercadoPagoOrderId || '';
  reservation.mercadoPagoPaymentId = snapshot.paymentId;
  reservation.mercadoPagoStatus = snapshot.paymentStatus;
  reservation.mercadoPagoStatusDetail = snapshot.paymentStatusDetail;
  reservation.mercadoPagoPaymentMethodId = snapshot.paymentMethodId;
  reservation.mercadoPagoPaymentMethodType = snapshot.paymentMethodType;
}

async function cancelUnpaidReservation(reservation) {
  reservation.paymentStatus = 'UNPAID';
  reservation.paidAt = null;

  if (reservation.status !== 'CANCELLED') {
    reservation.status = 'CANCELLED';
  }

  await reservation.save();
  return reservation;
}

async function maybeSendReservationConfirmationEmail(reservation) {
  if (!reservation || reservation.paymentStatus !== 'PAID') {
    return;
  }

  const hydratedReservation =
    reservation.user?.email &&
    reservation.court?.name &&
    reservation.complexId?.name &&
    reservation.complexId?.ownerId?.email
      ? reservation
      : await Reservation.findById(reservation._id)
          .populate('user', 'displayName email')
          .populate('court', 'name sport')
          .populate('complexId', 'name ownerId');

  if (!hydratedReservation) {
    return;
  }

  let shouldSave = false;

  if (!reservation.confirmationEmailSentAt && hydratedReservation.user?.email) {
    const clientResult = await sendReservationPaidEmail({
      reservation: hydratedReservation,
      user: hydratedReservation.user,
      court: hydratedReservation.court,
      complex: hydratedReservation.complexId,
    });

    if (clientResult?.sent) {
      reservation.confirmationEmailSentAt = new Date();
      shouldSave = true;
    }
  }

  if (!reservation.ownerNotificationSentAt && hydratedReservation.complexId?.ownerId?.email) {
    const ownerResult = await sendReservationOwnerPaidEmail({
      reservation: hydratedReservation,
      owner: hydratedReservation.complexId.ownerId,
      user: hydratedReservation.user,
      court: hydratedReservation.court,
      complex: hydratedReservation.complexId,
    });

    if (ownerResult?.sent) {
      reservation.ownerNotificationSentAt = new Date();
      shouldSave = true;
    }
  }

  if (shouldSave) {
    await reservation.save();
  }
}

async function syncReservationFromMercadoPagoOrder(reservation, mercadoPagoOrder) {
  const snapshot = getMercadoPagoOrderSnapshot(mercadoPagoOrder);
  const refundSnapshot = getMercadoPagoOrderRefundSnapshot(mercadoPagoOrder);
  applySnapshotToReservation(reservation, snapshot);
  reservation.mercadoPagoRefundId = refundSnapshot.refundId;
  reservation.mercadoPagoRefundStatus = refundSnapshot.refundStatus;

  if (isApprovedMercadoPagoOrder(mercadoPagoOrder)) {
    reservation.paymentStatus = 'PAID';
    reservation.paidAt = snapshot.approvedAt ? new Date(snapshot.approvedAt) : new Date();
    reservation.refundedAt = null;
    reservation.refundAmount = 0;
    if (reservation.status === 'PENDING') {
      reservation.status = 'CONFIRMED';
    }
  } else if (isRefundedMercadoPagoOrder(mercadoPagoOrder)) {
    reservation.paymentStatus = 'REFUNDED';
    reservation.status = 'CANCELLED';
    reservation.refundedAt = refundSnapshot.refundedAt ? new Date(refundSnapshot.refundedAt) : new Date();
    reservation.refundAmount = refundSnapshot.refundAmount || reservation.totalPrice;
  } else if (isPartiallyRefundedMercadoPagoOrder(mercadoPagoOrder)) {
    reservation.paymentStatus = 'PARTIAL';
    reservation.refundedAt = refundSnapshot.refundedAt ? new Date(refundSnapshot.refundedAt) : reservation.refundedAt;
    reservation.refundAmount = refundSnapshot.refundAmount || reservation.refundAmount || 0;
  } else if (isPendingMercadoPagoOrder(mercadoPagoOrder)) {
    reservation.paymentStatus = 'UNPAID';
  } else if (isCancelledMercadoPagoOrder(mercadoPagoOrder) || isFailedMercadoPagoOrder(mercadoPagoOrder)) {
    return cancelUnpaidReservation(reservation);
  }

  await reservation.save();
  await maybeSendReservationConfirmationEmail(reservation);
  return reservation;
}

async function syncReservationFromMercadoPagoPayment(reservation, mercadoPagoPayment) {
  const snapshot = getMercadoPagoPaymentSnapshot(mercadoPagoPayment);
  applyPaymentSnapshotToReservation(reservation, snapshot);

  if (isApprovedMercadoPagoPayment(mercadoPagoPayment)) {
    reservation.paymentStatus = 'PAID';
    reservation.paidAt = snapshot.approvedAt ? new Date(snapshot.approvedAt) : new Date();
    reservation.refundedAt = null;
    reservation.refundAmount = 0;
    if (reservation.status === 'PENDING') {
      reservation.status = 'CONFIRMED';
    }
  } else if (isRefundedMercadoPagoPayment(mercadoPagoPayment)) {
    reservation.paymentStatus = 'REFUNDED';
    reservation.status = 'CANCELLED';
    reservation.refundedAt = new Date();
    reservation.refundAmount = snapshot.refundedAmount || reservation.totalPrice;
  } else if (isPendingMercadoPagoPayment(mercadoPagoPayment)) {
    reservation.paymentStatus = 'UNPAID';
  } else if (
    isCancelledMercadoPagoPayment(mercadoPagoPayment) ||
    isFailedMercadoPagoPayment(mercadoPagoPayment)
  ) {
    return cancelUnpaidReservation(reservation);
  }

  await reservation.save();
  await maybeSendReservationConfirmationEmail(reservation);
  return reservation;
}

async function createReservationCheckout(reservation, user, paymentProvider) {
  const court = reservation.court?.name
    ? reservation.court
    : await Court.findById(reservation.court).select('name sport complexId image imageUrl images');
  const complex = reservation.complexId?.name
    ? reservation.complexId
    : await Complex.findById(reservation.complexId).select('name ownerId');

  const payer = resolveMercadoPagoPayerEmail({
    fallbackEmail: user.email,
    providerMode: paymentProvider.accountSummary?.mode,
  });

  const preference = await createCheckoutPreference({
    externalReference: reservation.externalReference,
    accessToken: paymentProvider.accessToken,
    payer: {
      email: payer.email,
    },
    items: [
      {
        id: String(reservation._id),
        title: `${court?.name || 'Cancha'} - ${reservation.startTime}`,
        description: buildReservationDescription(reservation, court, complex),
        quantity: 1,
        currency_id: 'ARS',
        unit_price: Number(reservation.totalPrice || 0),
        picture_url: court?.imageUrl || court?.image || court?.images?.[0] || undefined,
      },
    ],
    backUrls: {
      success: buildReservationReturnUrl(reservation, reservation.complexId?._id || reservation.complexId, 'success'),
      pending: buildReservationReturnUrl(reservation, reservation.complexId?._id || reservation.complexId, 'pending'),
      failure: buildReservationReturnUrl(reservation, reservation.complexId?._id || reservation.complexId, 'failure'),
    },
    notificationUrl: buildReservationNotificationUrl(reservation, complex),
    metadata: {
      entity: 'reservation',
      reservation_id: String(reservation._id),
    },
  });

  reservation.paymentMethod = 'ONLINE';
  reservation.mercadoPagoPreferenceId = String(preference?.id || '');
  await reservation.save();

  const checkoutUrl =
    paymentProvider.accountSummary?.mode === 'sandbox'
      ? String(preference?.sandbox_init_point || preference?.init_point || '')
      : String(preference?.init_point || preference?.sandbox_init_point || '');

  return {
    reservation,
    court,
    complex,
    paymentSession: serializeReservationPaymentSession(
      reservation,
      user,
      court,
      complex,
      paymentProvider,
      {
        preferenceId: reservation.mercadoPagoPreferenceId,
        checkoutUrl,
      },
    ),
  };
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

  if (reservation.status === 'CANCELLED') {
    const error = new Error('La reserva ya fue cancelada.');
    error.status = 409;
    throw error;
  }

  if (reservation.paymentStatus === 'PAID') {
    const error = new Error('La reserva ya fue pagada.');
    error.status = 409;
    throw error;
  }

  return reservation;
}

export const createReservation = async (req, res) => {
  try {
    const { courtId, date, startTime, paymentMethod: requestedPaymentMethod } = req.body;
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

    const paymentOptions = buildReservationPaymentOptions(paymentProvider);
    if (
      requestedPaymentMethod !== undefined &&
      String(requestedPaymentMethod || '').trim() &&
      !normalizeReservationPaymentMethod(requestedPaymentMethod)
    ) {
      return res.status(400).json({
        message: 'paymentMethod debe ser ON_SITE u ONLINE.',
      });
    }

    const paymentMethod = resolveRequestedReservationPaymentMethod(requestedPaymentMethod, {
      onlineEnabled: paymentOptions.onlineEnabled,
      role: user.role,
    });

    if (
      normalizeReservationPaymentMethod(requestedPaymentMethod) === 'ONLINE' &&
      paymentOptions.onlineEnabled !== true
    ) {
      return res.status(409).json({
        message: 'Este complejo no tiene cobros online habilitados para reservas. Elige pagar en cancha.',
      });
    }

    const reservation = new Reservation({
      user: user._id,
      court: court._id,
      complexId: court.complexId,
      date: dateObj,
      startTime,
      endTime,
      totalPrice: court.pricePerHour,
      status: 'PENDING',
      paymentMethod,
      externalReference: `reservation-draft-${user._id}-${Date.now()}`,
    });

    reservation.externalReference = buildReservationExternalReference(reservation._id.toString());

    const saved = await reservation.save();

    if (saved.paymentMethod === 'ONLINE' && paymentOptions.onlineEnabled === true) {
      try {
        const checkout = await createReservationCheckout(saved, user, paymentProvider);

        return res.status(201).json({
          reservation: serializeReservationRecord(checkout.reservation),
          providerConfigured: true,
          paymentSession: checkout.paymentSession,
        });
      } catch (paymentError) {
        await cancelUnpaidReservation(saved);

        const error = new Error(
          `${paymentError.message || 'No se pudo generar el checkout de Mercado Pago.'} La reserva fue cancelada y el horario se libero.`,
        );
        error.status = paymentError.status || 400;
        throw error;
      }
    }

    res.status(201).json({
      reservation: serializeReservationRecord(saved),
      providerConfigured: paymentOptions.onlineEnabled === true,
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
      ...serializeReservationRecord(reservation),
      date: reservation.date ? reservation.date.toISOString().slice(0, 10) : '',
      status: reservation.status.toLowerCase(),
      complex: reservation.complexId
        ? {
            _id: reservation.complexId._id,
            name: reservation.complexId.name,
          }
        : null,
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

    if (req.dbUser.role === 'owner') {
      await ensureOwnerOwnsComplex(reservation.complexId, req.dbUser);
    } else if (
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
    res.json({ message: 'Reserva cancelada', reservation: serializeReservationRecord(reservation) });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelando la reserva', error: error.message });
  }
};

export const refundReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('complexId', 'name ownerId')
      .populate('court', 'name sport');

    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada.' });
    }

    await ensureOwnerOwnsComplex(reservation.complexId?._id || reservation.complexId, req.dbUser);

    if (!reservation.mercadoPagoOrderId && !reservation.mercadoPagoPaymentId) {
      return res.status(409).json({
        message: 'Esta reserva no tiene un cobro de Mercado Pago asociado para reembolsar.',
      });
    }

    if (reservation.paymentStatus === 'REFUNDED') {
      return res.status(409).json({ message: 'La reserva ya fue reembolsada.' });
    }

    if (reservation.paymentStatus !== 'PAID') {
      return res.status(409).json({
        message: 'Solo se pueden reembolsar reservas pagadas completamente.',
      });
    }

    const paymentProvider = await getOwnerPaymentProvider(reservation.complexId.ownerId);
    if (!paymentProvider.configured) {
      return res.status(409).json({
        message: 'La cuenta de Mercado Pago del owner no esta disponible para procesar reembolsos.',
      });
    }

    let syncedReservation = reservation;

    if (reservation.mercadoPagoPaymentId) {
      await createMercadoPagoPaymentRefund({
        paymentId: reservation.mercadoPagoPaymentId,
        accessToken: paymentProvider.accessToken,
        idempotencyKey: `reservation-payment-refund:${reservation._id}`,
      });

      const latestPayment = await getMercadoPagoPayment(
        reservation.mercadoPagoPaymentId,
        paymentProvider.accessToken,
      );
      syncedReservation = await syncReservationFromMercadoPagoPayment(reservation, latestPayment);
    } else {
      const refundedOrder = await createMercadoPagoOrderRefund({
        orderId: reservation.mercadoPagoOrderId,
        accessToken: paymentProvider.accessToken,
        idempotencyKey: `reservation-refund:${reservation._id}`,
      });

      syncedReservation = await syncReservationFromMercadoPagoOrder(reservation, refundedOrder);

      if (syncedReservation.paymentStatus !== 'REFUNDED') {
        const latestOrder = await getMercadoPagoOrder(reservation.mercadoPagoOrderId, paymentProvider.accessToken);
        syncedReservation = await syncReservationFromMercadoPagoOrder(reservation, latestOrder);
      }
    }

    if (syncedReservation.paymentStatus !== 'REFUNDED') {
      return res.status(409).json({
        message: 'Mercado Pago no confirmo el reembolso completo de la reserva.',
        reservation: serializeReservationRecord(syncedReservation),
      });
    }

    res.json({
      message: 'Reserva reembolsada correctamente.',
      reservation: serializeReservationRecord(syncedReservation),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Error reembolsando la reserva.',
      error: error.message,
    });
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
    res.json({ message: 'Reserva confirmada', reservation: serializeReservationRecord(reservation) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error confirmando la reserva' });
  }
};

export const processReservationPayment = async (req, res) => {
  try {
    const { id } = req.params;
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

      try {
        const checkout = await createReservationCheckout(reservation, req.dbUser, paymentProvider);

        return res.json({
          message: 'Checkout generado correctamente.',
          reservation: serializeReservationRecord(checkout.reservation),
          paymentSession: checkout.paymentSession,
        });
    } catch (paymentError) {
      await cancelUnpaidReservation(reservation);

      const error = new Error(
        `${paymentError.message || 'No se pudo generar el checkout de Mercado Pago.'} La reserva fue cancelada y el horario se libero.`,
      );
      error.status = paymentError.status || 400;
      throw error;
    }
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Error procesando el pago de la reserva.',
      error: error.message,
    });
  }
};

export const syncReservationPayment = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('court', 'name sport complexId')
      .populate('complexId', 'name ownerId');

    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada.' });
    }

    if (reservation.user.toString() !== req.dbUser._id.toString()) {
      return res.status(403).json({ message: 'No autorizado para consultar esta reserva.' });
    }

    const paymentProvider = await getOwnerPaymentProvider(reservation.complexId.ownerId);
    if (!paymentProvider.configured) {
      return res.status(409).json({
        message: 'La cuenta de cobro del complejo no esta disponible.',
      });
    }

    const paymentId = String(
      req.body?.paymentId ||
      req.body?.collectionId ||
      req.query?.payment_id ||
      req.query?.collection_id ||
      reservation.mercadoPagoPaymentId ||
      '',
    ).trim();

    let syncedReservation = reservation;

    if (paymentId) {
      const mercadoPagoPayment = await getMercadoPagoPayment(paymentId, paymentProvider.accessToken);
      syncedReservation = await syncReservationFromMercadoPagoPayment(reservation, mercadoPagoPayment);
    } else {
      const resultHint = String(req.body?.result || req.query?.result || '').toLowerCase();
      if (resultHint === 'failure' && reservation.paymentStatus !== 'PAID') {
        syncedReservation = await cancelUnpaidReservation(reservation);
      }
    }

    res.json({
      message:
        syncedReservation.paymentStatus === 'PAID'
          ? 'Pago acreditado correctamente.'
          : syncedReservation.status === 'CANCELLED'
            ? 'La reserva fue cancelada y el horario se libero.'
            : 'El pago sigue pendiente de confirmacion.',
      reservation: serializeReservationRecord(syncedReservation),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'No se pudo sincronizar el pago de la reserva.',
      error: error.message,
    });
  }
};

export const handleMercadoPagoReservationWebhook = async (req, res) => {
  try {
    if (!validateMercadoPagoWebhookSignature(req)) {
      return res.status(401).json({ received: false, error: 'Firma de webhook invalida.' });
    }

    if (req.query?.reservationId) {
      const reservation = await Reservation.findById(req.query.reservationId)
        .populate('complexId', 'ownerId')
        .populate('court', 'name');

      if (!reservation) {
        return res.status(200).json({ received: true, ignored: true, reason: 'reservation_not_found' });
      }

      const ownerId = req.query?.ownerId || reservation.complexId?.ownerId;
      const paymentProvider = await getOwnerPaymentProvider(ownerId);
      if (!paymentProvider.configured) {
        return res.status(200).json({ received: true, ignored: true, reason: 'payment_account_not_configured' });
      }

      const paymentId = extractMercadoPagoPaymentId({
        ...req.body,
        query: req.query,
      });

      if (!paymentId) {
        return res.status(200).json({ received: true, ignored: true, reason: 'payment_id_missing' });
      }

      const mercadoPagoPayment = await getMercadoPagoPayment(paymentId, paymentProvider.accessToken);
      const syncedReservation = await syncReservationFromMercadoPagoPayment(reservation, mercadoPagoPayment);

      return res.status(200).json({
        received: true,
        reservation: serializeReservationRecord(syncedReservation),
      });
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

    res.status(200).json({
      received: true,
      reservation: serializeReservationRecord(syncedReservation),
    });
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
        return res.json([]);
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

    res.json(reservations.map((reservation) => serializeReservationRecord(reservation)));
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Error obteniendo reservas del complejo',
      error: error.message,
    });
  }
};
