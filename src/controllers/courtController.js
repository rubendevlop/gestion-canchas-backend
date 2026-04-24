import Court from '../models/Court.js';
import Complex from '../models/Complex.js';
import Reservation from '../models/Reservation.js';
import { sanitizeCourtFeatures } from '../constants/courtFeatures.js';
import {
  getPastBookingHoursForDate,
  isBookingTimeFormat,
  normalizeBookingDate,
  toBookingDateUtc,
} from '../utils/bookingAvailability.js';
import { normalizeBookingHours } from '../utils/bookingHours.js';
import { assertComplexClientAccess } from '../utils/ownerBilling.js';
import { destroyCloudinaryAsset } from '../utils/cloudinary.js';

const ACTIVE_BOOKING_STATE = 'ACTIVE';
const CHECKOUT_PENDING_BOOKING_STATE = 'CHECKOUT_PENDING';
const CHECKOUT_EXPIRED_BOOKING_STATE = 'CHECKOUT_EXPIRED';

const assertOwner = (complex, dbUser) => {
  if (dbUser.role === 'superadmin') return;
  if (complex.ownerId.toString() !== dbUser._id.toString()) {
    const err = new Error('No tenes permiso sobre este complejo.');
    err.status = 403;
    throw err;
  }
};

function parseFeaturesQuery(value = []) {
  if (Array.isArray(value)) {
    return sanitizeCourtFeatures(
      value.flatMap((item) => String(item || '').split(',')),
    );
  }

  return sanitizeCourtFeatures(String(value || '').split(','));
}

function buildTakenHoursByCourt(reservations = []) {
  const takenHoursByCourt = new Map();

  for (const reservation of reservations) {
    const courtId = String(reservation.court || '');
    if (!takenHoursByCourt.has(courtId)) {
      takenHoursByCourt.set(courtId, new Set());
    }

    takenHoursByCourt.get(courtId).add(reservation.startTime);
  }

  return takenHoursByCourt;
}

async function expireCourtPendingCheckouts(courtIds = [], date = null) {
  if (!date || courtIds.length === 0) {
    return;
  }

  await Reservation.updateMany(
    {
      bookingState: CHECKOUT_PENDING_BOOKING_STATE,
      checkoutExpiresAt: { $lte: new Date() },
      court: { $in: courtIds },
      date,
    },
    {
      $set: {
        bookingState: CHECKOUT_EXPIRED_BOOKING_STATE,
        checkoutExpiresAt: null,
        status: 'CANCELLED',
        paymentStatus: 'UNPAID',
        paidAt: null,
      },
    },
  );
}

function buildCourtAvailabilitySummary(court, takenHoursByCourt = new Map(), options = {}) {
  const normalizedDate = options.date || '';
  const requestedTime = String(options.startTime || '').trim();
  const bookingHours = normalizeBookingHours(court.bookingHours);
  const pastHours = new Set(
    normalizedDate ? getPastBookingHoursForDate(bookingHours, normalizedDate) : [],
  );
  const takenHours = takenHoursByCourt.get(String(court._id)) || new Set();
  const availableHours = bookingHours.filter((hour) => !pastHours.has(hour) && !takenHours.has(hour));
  const availableAtRequestedTime = requestedTime ? availableHours.includes(requestedTime) : null;

  return {
    date: normalizedDate,
    startTime: requestedTime,
    totalHoursCount: bookingHours.length,
    availableHoursCount: availableHours.length,
    nextAvailableTime: availableHours[0] || '',
    availableAtRequestedTime,
    hasAvailability: requestedTime ? Boolean(availableAtRequestedTime) : availableHours.length > 0,
  };
}

function serializeCourt(court, takenHoursByCourt = new Map(), options = {}) {
  return {
    ...court.toObject(),
    bookingHours: normalizeBookingHours(court.bookingHours),
    features: sanitizeCourtFeatures(court.features),
    availabilitySummary: buildCourtAvailabilitySummary(court, takenHoursByCourt, options),
  };
}

// GET /api/courts?complexId=X
export const getCourts = async (req, res) => {
  try {
    const filter = {};
    const normalizedDate = req.query.date ? normalizeBookingDate(req.query.date) : '';
    const requestedTime = String(req.query.startTime || '').trim();
    const selectedFeatures = parseFeaturesQuery(req.query.features);
    const availableOnly = req.query.availableOnly === 'true';

    if (req.query.date && !normalizedDate) {
      return res.status(400).json({ message: 'date debe tener formato YYYY-MM-DD.' });
    }

    if (requestedTime && !normalizedDate) {
      return res.status(400).json({ message: 'Para filtrar por horario debes enviar date.' });
    }

    if (requestedTime && !isBookingTimeFormat(requestedTime)) {
      return res.status(400).json({ message: 'startTime debe tener formato HH:mm.' });
    }

    if (req.query.complexId) {
      filter.complexId = req.query.complexId;
    }

    if (req.query.clientVisible === 'true' && req.query.complexId) {
      await assertComplexClientAccess(req.query.complexId, { createBillingIfMissing: true });
      filter.isAvailable = true;
    }

    let courts = await Court.find(filter);

    courts = courts.filter((court) => {
      const courtFeatures = sanitizeCourtFeatures(court.features);
      return selectedFeatures.every((feature) => courtFeatures.includes(feature));
    });

    let takenHoursByCourt = new Map();

    if (normalizedDate && courts.length > 0) {
      const dateObj = toBookingDateUtc(normalizedDate);
      const courtIds = courts.map((court) => court._id);

      await expireCourtPendingCheckouts(courtIds, dateObj);

      const reservations = await Reservation.find({
        court: { $in: courtIds },
        date: dateObj,
        $or: [
          {
            $and: [
              {
                $or: [
                  { bookingState: ACTIVE_BOOKING_STATE },
                  { bookingState: { $exists: false } },
                ],
              },
              { status: { $ne: 'CANCELLED' } },
            ],
          },
          {
            bookingState: CHECKOUT_PENDING_BOOKING_STATE,
            checkoutExpiresAt: { $gt: new Date() },
          },
        ],
      }).select('court startTime');

      takenHoursByCourt = buildTakenHoursByCourt(reservations);
    }

    const payload = courts
      .map((court) =>
        serializeCourt(court, takenHoursByCourt, {
          date: normalizedDate,
          startTime: requestedTime,
        }),
      )
      .filter((court) => !availableOnly || !normalizedDate || court.availabilitySummary.hasAvailability)
      .sort((left, right) => {
        if (normalizedDate) {
          return (
            Number(right.availabilitySummary.hasAvailability) - Number(left.availabilitySummary.hasAvailability) ||
            right.availabilitySummary.availableHoursCount - left.availabilitySummary.availableHoursCount ||
            Number(left.pricePerHour || 0) - Number(right.pricePerHour || 0) ||
            left.name.localeCompare(right.name, 'es')
          );
        }

        return left.name.localeCompare(right.name, 'es');
      });

    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({
      message: 'Error obteniendo las canchas',
      error: error.message,
    });
  }
};

// GET /api/courts/:id
export const getCourtById = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);
    if (!court) return res.status(404).json({ message: 'Cancha no encontrada' });

    if (req.query.clientVisible === 'true') {
      await assertComplexClientAccess(court.complexId, { createBillingIfMissing: true });
      if (!court.isAvailable) {
        return res.status(404).json({ message: 'Cancha no disponible' });
      }
    }

    res.json(serializeCourt(court));
  } catch (error) {
    res.status(error.status || 500).json({
      message: 'Error obteniendo la cancha',
      error: error.message,
    });
  }
};

// POST /api/courts
export const createCourt = async (req, res) => {
  try {
    const {
      name,
      sport,
      capacity,
      pricePerHour,
      bookingHours,
      features,
      description,
      image,
      imagePublicId,
      complexId,
    } = req.body;

    const complex = await Complex.findById(complexId);
    if (!complex) return res.status(404).json({ message: 'Complejo no encontrado' });

    assertOwner(complex, req.dbUser);

    const normalizedImage = String(image || '').trim();
    const court = new Court({
      name,
      sport,
      capacity,
      pricePerHour,
      bookingHours: normalizeBookingHours(bookingHours),
      features: sanitizeCourtFeatures(features),
      description,
      image: normalizedImage,
      imagePublicId: String(imagePublicId || '').trim(),
      images: normalizedImage ? [normalizedImage] : [],
      complexId,
    });

    await court.save();
    res.status(201).json(serializeCourt(court));
  } catch (error) {
    res.status(error.status || 400).json({
      message: error.message || 'Error creando la cancha',
    });
  }
};

// PUT /api/courts/:id
export const updateCourt = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id).populate('complexId');
    if (!court) return res.status(404).json({ message: 'Cancha no encontrada' });

    assertOwner(court.complexId, req.dbUser);

    const {
      name,
      sport,
      capacity,
      pricePerHour,
      bookingHours,
      features,
      description,
      isAvailable,
      image,
      imagePublicId,
    } = req.body;

    const previousImagePublicId = court.imagePublicId || '';

    if (name !== undefined) court.name = name;
    if (sport !== undefined) court.sport = sport;
    if (capacity !== undefined) court.capacity = capacity;
    if (pricePerHour !== undefined) court.pricePerHour = pricePerHour;
    if (bookingHours !== undefined) court.bookingHours = normalizeBookingHours(bookingHours);
    if (features !== undefined) court.features = sanitizeCourtFeatures(features);
    if (description !== undefined) court.description = description;
    if (isAvailable !== undefined) court.isAvailable = isAvailable;
    if (image !== undefined) {
      court.image = String(image || '').trim();
      court.images = court.image ? [court.image] : [];
    }
    if (imagePublicId !== undefined) {
      court.imagePublicId = String(imagePublicId || '').trim();
    }

    await court.save();

    if (
      previousImagePublicId &&
      imagePublicId !== undefined &&
      previousImagePublicId !== court.imagePublicId
    ) {
      await destroyCloudinaryAsset(previousImagePublicId);
    }

    res.json(serializeCourt(court));
  } catch (error) {
    res.status(error.status || 400).json({
      message: error.message || 'Error actualizando la cancha',
    });
  }
};

// DELETE /api/courts/:id
export const deleteCourt = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id).populate('complexId');
    if (!court) return res.status(404).json({ message: 'Cancha no encontrada' });

    assertOwner(court.complexId, req.dbUser);

    const imagePublicId = court.imagePublicId || '';
    await court.deleteOne();
    await destroyCloudinaryAsset(imagePublicId);

    res.json({ message: 'Cancha eliminada correctamente' });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Error eliminando la cancha',
    });
  }
};
