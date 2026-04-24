import Complex from '../models/Complex.js';
import Court from '../models/Court.js';
import Reservation from '../models/Reservation.js';
import { sanitizeComplexAmenities } from '../constants/complexAmenities.js';
import {
  assertComplexClientAccess,
  filterClientVisibleComplexes,
} from '../utils/ownerBilling.js';
import {
  getPastBookingHoursForDate,
  isBookingTimeFormat,
  normalizeBookingDate,
  toBookingDateUtc,
} from '../utils/bookingAvailability.js';
import { normalizeBookingHours } from '../utils/bookingHours.js';
import { getOwnerPaymentProvider } from '../utils/paymentAccounts.js';
import { destroyCloudinaryAsset } from '../utils/cloudinary.js';

const ACTIVE_BOOKING_STATE = 'ACTIVE';
const CHECKOUT_PENDING_BOOKING_STATE = 'CHECKOUT_PENDING';
const CHECKOUT_EXPIRED_BOOKING_STATE = 'CHECKOUT_EXPIRED';

function buildOwnerContact(owner, complex = null) {
  const phone = String(complex?.phone || owner?.phone || owner?.ownerApplication?.contactPhone || '').trim();
  const email = String(owner?.email || '').trim();
  const displayName = String(owner?.displayName || '').trim();

  return {
    displayName,
    phone,
    email,
  };
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

function buildStorePaymentOptions(paymentProvider = {}) {
  const onlineEnabled =
    paymentProvider.configured === true &&
    paymentProvider.accountSummary?.ordersEnabled !== false;

  return {
    defaultMethod: onlineEnabled ? 'ONLINE' : 'ON_SITE',
    onSiteEnabled: true,
    onlineEnabled,
    provider: onlineEnabled ? 'mercadopago' : '',
    providerMode: onlineEnabled ? paymentProvider.accountSummary?.mode || '' : '',
  };
}

async function withCourtsCount(complexes) {
  return Promise.all(
    complexes.map(async (complex) => {
      const courtsCount = await Court.countDocuments({ complexId: complex._id });
      return {
        ...complex.toObject(),
        amenities: sanitizeComplexAmenities(complex.amenities),
        courtsCount,
      };
    }),
  );
}

function normalizeSearchValue(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function parseAmenitiesQuery(value = []) {
  if (Array.isArray(value)) {
    return sanitizeComplexAmenities(
      value.flatMap((item) => String(item || '').split(',')),
    );
  }

  return sanitizeComplexAmenities(String(value || '').split(','));
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

async function expireDiscoveryPendingCheckouts(courtIds = [], date = null) {
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

function buildComplexAvailabilitySummary(courts = [], takenHoursByCourt = new Map(), options = {}) {
  const normalizedDate = options.date || '';
  const requestedTime = String(options.startTime || '').trim();

  let availableCourtsCount = 0;
  let availableSlotsCount = 0;
  let nextAvailableTime = '';
  let minPricePerHour = 0;

  for (const court of courts) {
    const bookingHours = normalizeBookingHours(court.bookingHours);
    const pastHours = new Set(
      normalizedDate ? getPastBookingHoursForDate(bookingHours, normalizedDate) : [],
    );
    const totalHours = normalizedDate
      ? bookingHours.filter((hour) => !pastHours.has(hour))
      : bookingHours;
    const takenHours = takenHoursByCourt.get(String(court._id)) || new Set();
    const availableHours = requestedTime
      ? totalHours.filter((hour) => hour === requestedTime && !takenHours.has(hour))
      : totalHours.filter((hour) => !takenHours.has(hour));

    if (availableHours.length > 0) {
      availableCourtsCount += 1;
      availableSlotsCount += availableHours.length;

      if (!nextAvailableTime || availableHours[0].localeCompare(nextAvailableTime) < 0) {
        nextAvailableTime = availableHours[0];
      }
    }

    if (!minPricePerHour || Number(court.pricePerHour) < minPricePerHour) {
      minPricePerHour = Number(court.pricePerHour) || 0;
    }
  }

  return {
    date: normalizedDate,
    startTime: requestedTime,
    totalCourtsCount: courts.length,
    availableCourtsCount,
    availableSlotsCount,
    nextAvailableTime,
    minPricePerHour,
    hasAvailability: normalizedDate ? availableSlotsCount > 0 : courts.length > 0,
  };
}

export const discoverComplexes = async (req, res) => {
  try {
    const normalizedDate = req.query.date ? normalizeBookingDate(req.query.date) : '';
    const requestedTime = String(req.query.startTime || '').trim();
    const search = normalizeSearchValue(req.query.search);
    const selectedAmenities = parseAmenitiesQuery(req.query.amenities);
    const availableOnly = req.query.availableOnly === 'true';

    if (req.query.date && !normalizedDate) {
      return res.status(400).json({ error: 'date debe tener formato YYYY-MM-DD.' });
    }

    if (requestedTime && !normalizedDate) {
      return res.status(400).json({ error: 'Para filtrar por horario tambien debes enviar una fecha.' });
    }

    if (requestedTime && !isBookingTimeFormat(requestedTime)) {
      return res.status(400).json({ error: 'startTime debe tener formato HH:mm.' });
    }

    let complexes = await Complex.find({ isActive: true }).populate(
      'ownerId',
      'displayName email phone ownerApplication.contactPhone',
    );

    complexes = await filterClientVisibleComplexes(complexes, { createBillingIfMissing: true });

    const filteredComplexes = complexes.filter((complex) => {
      const complexAmenities = sanitizeComplexAmenities(complex.amenities);
      const matchesSearch =
        !search ||
        [complex?.name, complex?.address]
          .map(normalizeSearchValue)
          .join(' ')
          .includes(search);
      const matchesAmenities = selectedAmenities.every((amenity) => complexAmenities.includes(amenity));

      return matchesSearch && matchesAmenities;
    });

    if (filteredComplexes.length === 0) {
      return res.json([]);
    }

    const complexIds = filteredComplexes.map((complex) => complex._id);
    const courts = await Court.find({
      complexId: { $in: complexIds },
      isAvailable: true,
    }).select('name pricePerHour bookingHours complexId image images');
    const courtsByComplexId = new Map();

    for (const court of courts) {
      const complexId = String(court.complexId);
      if (!courtsByComplexId.has(complexId)) {
        courtsByComplexId.set(complexId, []);
      }

      courtsByComplexId.get(complexId).push(court);
    }

    let takenHoursByCourt = new Map();

    if (normalizedDate && courts.length > 0) {
      const dateObj = toBookingDateUtc(normalizedDate);
      const courtIds = courts.map((court) => court._id);

      await expireDiscoveryPendingCheckouts(courtIds, dateObj);

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

    const payload = filteredComplexes
      .map((complex) => {
        const complexCourts = courtsByComplexId.get(String(complex._id)) || [];
        const availabilitySummary = buildComplexAvailabilitySummary(
          complexCourts,
          takenHoursByCourt,
          {
            date: normalizedDate,
            startTime: requestedTime,
          },
        );

        return {
          ...complex.toObject(),
          ownerId: complex.ownerId?._id
            ? {
                _id: complex.ownerId._id,
                displayName: complex.ownerId.displayName || '',
              }
            : complex.ownerId,
          ownerContact: buildOwnerContact(complex.ownerId, complex),
          amenities: sanitizeComplexAmenities(complex.amenities),
          courtsCount: complexCourts.length,
          availabilitySummary,
        };
      })
      .filter((complex) => !availableOnly || !normalizedDate || complex.availabilitySummary.hasAvailability)
      .sort((left, right) => {
        if (normalizedDate) {
          return (
            right.availabilitySummary.availableSlotsCount - left.availabilitySummary.availableSlotsCount ||
            right.availabilitySummary.availableCourtsCount - left.availabilitySummary.availableCourtsCount ||
            right.courtsCount - left.courtsCount ||
            left.name.localeCompare(right.name, 'es')
          );
        }

        return right.courtsCount - left.courtsCount || left.name.localeCompare(right.name, 'es');
      });

    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Error al obtener complejos para el buscador',
      detail: error.message,
    });
  }
};

export const createComplex = async (req, res) => {
  try {
    const { name, address, phone, amenities, logo, logoPublicId, openingHours } = req.body;
    const ownerId =
      req.dbUser.role === 'superadmin' && req.body.ownerId ? req.body.ownerId : req.dbUser._id;

    const newComplex = new Complex({
      name,
      address,
      phone: String(phone || '').trim(),
      amenities: sanitizeComplexAmenities(amenities),
      logo: String(logo || '').trim(),
      logoPublicId: String(logoPublicId || '').trim(),
      openingHours,
      ownerId,
    });
    await newComplex.save();
    res.status(201).json(newComplex);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear el complejo', detail: error.message });
  }
};

export const getComplexes = async (req, res) => {
  try {
    const filter = {};
    if (req.query.ownerId) filter.ownerId = req.query.ownerId;
    if (req.query.active) filter.isActive = req.query.active === 'true';

    let complexes = await Complex.find(filter).populate('ownerId', 'displayName email role ownerStatus');

    if (req.query.clientVisible === 'true') {
      complexes = await filterClientVisibleComplexes(complexes, { createBillingIfMissing: true });
    }

    res.json(await withCourtsCount(complexes));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener complejos', detail: error.message });
  }
};

export const getComplexById = async (req, res) => {
  try {
    let complex;
    let ownerContact = null;
    let reservationPaymentOptions = buildReservationPaymentOptions();
    let storePaymentOptions = buildStorePaymentOptions();

    if (req.query.clientVisible === 'true') {
      const state = await assertComplexClientAccess(req.params.id, { createBillingIfMissing: true });
      complex = state.complex;
      ownerContact = buildOwnerContact(state.owner, state.complex);
      try {
        const paymentProvider = state.owner?._id
          ? await getOwnerPaymentProvider(state.owner._id)
          : { configured: false, accountSummary: null };
        reservationPaymentOptions = buildReservationPaymentOptions(paymentProvider);
        storePaymentOptions = buildStorePaymentOptions(paymentProvider);
      } catch (paymentProviderError) {
        console.error(
          'No se pudo resolver la configuracion de cobro del complejo:',
          paymentProviderError.message,
        );
      }
    } else {
      complex = await Complex.findById(req.params.id).populate('ownerId', 'displayName email role ownerStatus');
    }

    if (!complex) {
      return res.status(404).json({ error: 'Complejo no encontrado' });
    }

    const courtsCount = await Court.countDocuments({ complexId: complex._id });
    const response = { ...complex.toObject(), courtsCount };

    if (req.query.clientVisible === 'true') {
      response.amenities = sanitizeComplexAmenities(response.amenities);
      response.ownerContact = ownerContact;
      response.reservationPaymentOptions = reservationPaymentOptions;
      response.storePaymentOptions = storePaymentOptions;

      if (response.ownerId && typeof response.ownerId === 'object') {
        response.ownerId = {
          _id: response.ownerId._id,
          displayName: response.ownerId.displayName || '',
        };
      }
    }

    res.json(response);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Error al obtener el complejo',
      detail: error.message,
    });
  }
};

export const getMyComplex = async (req, res) => {
  try {
    const complex = await Complex.findOne({ ownerId: req.dbUser._id });
    if (!complex) {
      return res.status(404).json({ error: 'No tenes ningun complejo configurado.' });
    }

    const courtsCount = await Court.countDocuments({ complexId: complex._id });
    res.json({
      ...complex.toObject(),
      amenities: sanitizeComplexAmenities(complex.amenities),
      courtsCount,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tu complejo', detail: error.message });
  }
};

export const updateComplex = async (req, res) => {
  try {
    const complex = await Complex.findById(req.params.id);
    if (!complex) {
      return res.status(404).json({ error: 'Complejo no encontrado' });
    }

    if (
      req.dbUser.role !== 'superadmin' &&
      complex.ownerId.toString() !== req.dbUser._id.toString()
    ) {
      return res.status(403).json({ error: 'No tenes permiso para editar este complejo.' });
    }

    const { name, address, phone, amenities, logo, logoPublicId, openingHours, isActive } = req.body;
    const previousLogoPublicId = complex.logoPublicId || '';
    if (name !== undefined) complex.name = name;
    if (address !== undefined) complex.address = address;
    if (phone !== undefined) complex.phone = String(phone || '').trim();
    if (amenities !== undefined) complex.amenities = sanitizeComplexAmenities(amenities);
    if (logo !== undefined) complex.logo = String(logo || '').trim();
    if (logoPublicId !== undefined) complex.logoPublicId = String(logoPublicId || '').trim();
    if (openingHours !== undefined) complex.openingHours = openingHours;
    if (isActive !== undefined) complex.isActive = isActive;

    await complex.save();

    if (
      previousLogoPublicId &&
      logoPublicId !== undefined &&
      previousLogoPublicId !== complex.logoPublicId
    ) {
      await destroyCloudinaryAsset(previousLogoPublicId);
    }

    res.json(complex);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el complejo', detail: error.message });
  }
};
