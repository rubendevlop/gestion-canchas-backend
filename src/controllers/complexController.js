import Complex from '../models/Complex.js';
import Court from '../models/Court.js';
import {
  assertComplexClientAccess,
  filterClientVisibleComplexes,
} from '../utils/ownerBilling.js';
import { getOwnerPaymentProvider } from '../utils/paymentAccounts.js';
import { destroyCloudinaryAsset } from '../utils/cloudinary.js';

function buildOwnerContact(owner, complex = null) {
  const phone = String(owner?.phone || owner?.ownerApplication?.contactPhone || complex?.phone || '').trim();
  const email = String(owner?.email || '').trim();

  return {
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

async function withCourtsCount(complexes) {
  return Promise.all(
    complexes.map(async (complex) => {
      const courtsCount = await Court.countDocuments({ complexId: complex._id });
      return { ...complex.toObject(), courtsCount };
    }),
  );
}

export const createComplex = async (req, res) => {
  try {
    const { name, address, phone, logo, logoPublicId, openingHours } = req.body;
    const ownerId =
      req.dbUser.role === 'superadmin' && req.body.ownerId ? req.body.ownerId : req.dbUser._id;

    const newComplex = new Complex({
      name,
      address,
      phone,
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

    if (req.query.clientVisible === 'true') {
      const state = await assertComplexClientAccess(req.params.id, { createBillingIfMissing: true });
      complex = state.complex;
      ownerContact = buildOwnerContact(state.owner, state.complex);
      try {
        const paymentProvider = state.owner?._id
          ? await getOwnerPaymentProvider(state.owner._id)
          : { configured: false, accountSummary: null };
        reservationPaymentOptions = buildReservationPaymentOptions(paymentProvider);
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
      response.ownerContact = ownerContact;
      response.reservationPaymentOptions = reservationPaymentOptions;

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
    res.json({ ...complex.toObject(), courtsCount });
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

    const { name, address, phone, logo, logoPublicId, openingHours, isActive } = req.body;
    const previousLogoPublicId = complex.logoPublicId || '';
    if (name !== undefined) complex.name = name;
    if (address !== undefined) complex.address = address;
    if (phone !== undefined) complex.phone = phone;
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
