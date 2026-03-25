import User from '../models/User.js';
import Complex from '../models/Complex.js';
import Court from '../models/Court.js';
import Order from '../models/Order.js';
import Reservation from '../models/Reservation.js';
import { getOwnerBillingState } from '../utils/ownerBilling.js';
import { resolveDbUser } from '../utils/resolveDbUser.js';

async function buildUserResponse(user, options = {}) {
  const { createBillingIfMissing = true } = options;

  if (!user) return null;

  const payload = user.toObject ? user.toObject() : { ...user };
  payload.ownerBilling = await getOwnerBillingState(user, {
    createIfMissing: createBillingIfMissing,
  });

  return payload;
}

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchPredicate(search = '', values = []) {
  if (!search) return true;

  const normalizedSearch = search.toLowerCase();
  return values.some((value) =>
    String(value ?? '')
      .toLowerCase()
      .includes(normalizedSearch),
  );
}

function getReservationStatsDefaults() {
  return {
    reservationCount: 0,
    confirmedReservationCount: 0,
    pendingReservationCount: 0,
    cancelledReservationCount: 0,
    totalReservationAmount: 0,
    confirmedReservationAmount: 0,
    lastReservationAt: null,
  };
}

function getOrderStatsDefaults() {
  return {
    orderCount: 0,
    completedOrderCount: 0,
    pendingOrderCount: 0,
    cancelledOrderCount: 0,
    failedOrderCount: 0,
    totalOrderAmount: 0,
    completedOrderAmount: 0,
    lastOrderAt: null,
  };
}

async function buildReservationStatsMap(match) {
  const rows = await Reservation.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$user',
        reservationCount: { $sum: 1 },
        confirmedReservationCount: {
          $sum: { $cond: [{ $eq: ['$status', 'CONFIRMED'] }, 1, 0] },
        },
        pendingReservationCount: {
          $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
        },
        cancelledReservationCount: {
          $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] },
        },
        totalReservationAmount: {
          $sum: { $ifNull: ['$totalPrice', 0] },
        },
        confirmedReservationAmount: {
          $sum: {
            $cond: [
              { $eq: ['$status', 'CONFIRMED'] },
              { $ifNull: ['$totalPrice', 0] },
              0,
            ],
          },
        },
        lastReservationAt: { $max: '$date' },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      row._id.toString(),
      {
        ...getReservationStatsDefaults(),
        ...row,
      },
    ]),
  );
}

async function buildOrderStatsMap(match) {
  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$userId',
        orderCount: { $sum: 1 },
        completedOrderCount: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        pendingOrderCount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
        },
        cancelledOrderCount: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        failedOrderCount: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
        },
        totalOrderAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        completedOrderAmount: {
          $sum: {
            $cond: [
              { $eq: ['$status', 'completed'] },
              { $ifNull: ['$totalAmount', 0] },
              0,
            ],
          },
        },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      row._id.toString(),
      {
        ...getOrderStatsDefaults(),
        ...row,
      },
    ]),
  );
}

async function buildOwnerComplexMap(ownerIds) {
  if (ownerIds.length === 0) return new Map();

  const complexes = await Complex.find({ ownerId: { $in: ownerIds } })
    .select('name address phone isActive ownerId createdAt')
    .sort({ createdAt: -1 })
    .lean();

  return complexes.reduce((map, complex) => {
    const key = complex.ownerId.toString();
    const current = map.get(key) || [];
    current.push({
      _id: complex._id,
      name: complex.name,
      address: complex.address,
      phone: complex.phone,
      isActive: complex.isActive,
      createdAt: complex.createdAt,
    });
    map.set(key, current);
    return map;
  }, new Map());
}

function buildUserDirectoryEntry(user, reservationStats, orderStats, ownerBilling, complexes = []) {
  const normalizedReservationStats = reservationStats || getReservationStatsDefaults();
  const normalizedOrderStats = orderStats || getOrderStatsDefaults();
  const lastActivityAt = [normalizedReservationStats.lastReservationAt, normalizedOrderStats.lastOrderAt]
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null;

  return {
    _id: user._id,
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL || '',
    role: user.role,
    ownerStatus: user.ownerStatus || null,
    ownerStatusNote: user.ownerStatusNote || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    complexes,
    ownerBilling,
    metrics: {
      reservations: {
        total: normalizedReservationStats.reservationCount,
        confirmed: normalizedReservationStats.confirmedReservationCount,
        pending: normalizedReservationStats.pendingReservationCount,
        cancelled: normalizedReservationStats.cancelledReservationCount,
        amount: normalizedReservationStats.totalReservationAmount,
        confirmedAmount: normalizedReservationStats.confirmedReservationAmount,
        lastAt: normalizedReservationStats.lastReservationAt,
      },
      orders: {
        total: normalizedOrderStats.orderCount,
        completed: normalizedOrderStats.completedOrderCount,
        pending: normalizedOrderStats.pendingOrderCount,
        cancelled: normalizedOrderStats.cancelledOrderCount,
        failed: normalizedOrderStats.failedOrderCount,
        amount: normalizedOrderStats.totalOrderAmount,
        completedAmount: normalizedOrderStats.completedOrderAmount,
        lastAt: normalizedOrderStats.lastOrderAt,
      },
      lastActivityAt,
    },
  };
}

async function buildLatestReservationMap(match) {
  const rows = await Reservation.aggregate([
    { $match: match },
    { $sort: { date: -1, startTime: -1, createdAt: -1 } },
    {
      $group: {
        _id: '$user',
        reservationId: { $first: '$_id' },
        courtId: { $first: '$court' },
        date: { $first: '$date' },
        startTime: { $first: '$startTime' },
        endTime: { $first: '$endTime' },
        status: { $first: '$status' },
        paymentStatus: { $first: '$paymentStatus' },
        totalPrice: { $first: '$totalPrice' },
      },
    },
  ]);

  const courtIds = rows.map((row) => row.courtId).filter(Boolean);
  const courts = await Court.find({ _id: { $in: courtIds } }).select('name').lean();
  const courtMap = new Map(courts.map((court) => [court._id.toString(), court]));

  return new Map(
    rows.map((row) => [
      row._id.toString(),
      {
        _id: row.reservationId,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        status: row.status,
        paymentStatus: row.paymentStatus,
        totalPrice: row.totalPrice,
        court: row.courtId
          ? {
              _id: row.courtId,
              name: courtMap.get(row.courtId.toString())?.name || 'Cancha',
            }
          : null,
      },
    ]),
  );
}

// POST /api/users/register
export const registerUser = async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user;
    const { displayName } = req.body || {};

    let user = await User.findOne({ $or: [{ uid }, { email }] });
    if (user) {
      return res.status(400).json({ message: 'El usuario ya se encuentra registrado.' });
    }

    user = new User({
      uid,
      email,
      displayName: displayName || name || email.split('@')[0],
      photoURL: picture,
      role: req.body.registerAs === 'owner' ? 'owner' : 'client',
      ownerStatus: req.body.registerAs === 'owner' ? 'PENDING' : null,
    });

    await user.save();
    res.status(201).json(await buildUserResponse(user, { createBillingIfMissing: false }));
  } catch (error) {
    res.status(500).json({ message: 'Error registrando usuario', error: error.message });
  }
};

// POST /api/users/login
export const loginUser = async (req, res) => {
  try {
    const user = await resolveDbUser(req.user);

    if (!user) {
      return res.status(403).json({
        error: 'USER_NOT_REGISTERED',
        message: 'Acceso denegado: Debes registrarte antes de iniciar sesion.',
      });
    }

    res.status(200).json(await buildUserResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Error en el login', error: error.message });
  }
};

// GET /api/users/me
export const getCurrentUser = async (req, res) => {
  try {
    const user = await resolveDbUser(req.user);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(await buildUserResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo perfil', error: error.message });
  }
};

// GET /api/users
export const listUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.ownerStatus) filter.ownerStatus = req.query.ownerStatus;

    const users = await User.find(filter).select('-__v').sort({ createdAt: -1 });
    const payload = await Promise.all(
      users.map((user) => buildUserResponse(user, { createBillingIfMissing: false })),
    );
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Error listando usuarios', error: error.message });
  }
};

// GET /api/users/directory
export const getUserDirectory = async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();

    if (req.dbUser.role === 'owner') {
      const ownedComplexes = await Complex.find({ ownerId: req.dbUser._id }).select('_id name').lean();
      if (ownedComplexes.length === 0) {
        return res.json([]);
      }

      const complexIds = ownedComplexes.map((complex) => complex._id);
      const reservationStatsMap = await buildReservationStatsMap({
        complexId: { $in: complexIds },
      });

      const customerIds = [...reservationStatsMap.keys()];
      if (customerIds.length === 0) {
        return res.json([]);
      }

      const customers = await User.find({
        _id: { $in: customerIds },
        role: 'client',
      })
        .select('displayName email photoURL createdAt updatedAt role')
        .sort({ createdAt: -1 });

      const latestReservationMap = await buildLatestReservationMap({
        complexId: { $in: complexIds },
        user: { $in: customers.map((customer) => customer._id) },
      });

      let payload = customers.map((customer) => ({
        _id: customer._id,
        displayName: customer.displayName,
        email: customer.email,
        photoURL: customer.photoURL || '',
        role: customer.role,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        metrics: {
          reservations: {
            total: reservationStatsMap.get(customer._id.toString())?.reservationCount || 0,
            confirmed: reservationStatsMap.get(customer._id.toString())?.confirmedReservationCount || 0,
            pending: reservationStatsMap.get(customer._id.toString())?.pendingReservationCount || 0,
            cancelled: reservationStatsMap.get(customer._id.toString())?.cancelledReservationCount || 0,
            amount: reservationStatsMap.get(customer._id.toString())?.totalReservationAmount || 0,
            confirmedAmount:
              reservationStatsMap.get(customer._id.toString())?.confirmedReservationAmount || 0,
            lastAt: reservationStatsMap.get(customer._id.toString())?.lastReservationAt || null,
          },
          lastActivityAt: reservationStatsMap.get(customer._id.toString())?.lastReservationAt || null,
        },
        latestReservation: latestReservationMap.get(customer._id.toString()) || null,
      }));

      if (search) {
        payload = payload.filter((customer) =>
          buildSearchPredicate(search, [
            customer.displayName,
            customer.email,
            customer.latestReservation?.court?.name,
            customer.latestReservation?.status,
            customer.latestReservation?.paymentStatus,
          ]),
        );
      }

      payload.sort((left, right) => {
        const leftDate = left.metrics.lastActivityAt ? new Date(left.metrics.lastActivityAt).getTime() : 0;
        const rightDate = right.metrics.lastActivityAt ? new Date(right.metrics.lastActivityAt).getTime() : 0;
        return rightDate - leftDate;
      });

      return res.json(payload);
    }

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.ownerStatus) filter.ownerStatus = req.query.ownerStatus;

    const users = await User.find(filter).select('-__v').sort({ createdAt: -1 });
    const userIds = users.map((user) => user._id);
    const ownerIds = users.filter((user) => user.role === 'owner').map((user) => user._id);

    const [reservationStatsMap, orderStatsMap, ownerComplexMap, ownerBillingList] = await Promise.all([
      buildReservationStatsMap({ user: { $in: userIds } }),
      buildOrderStatsMap({ userId: { $in: userIds } }),
      buildOwnerComplexMap(ownerIds),
      Promise.all(
        users.map(async (user) => [
          user._id.toString(),
          await getOwnerBillingState(user, { createIfMissing: false }),
        ]),
      ),
    ]);

    const ownerBillingMap = new Map(ownerBillingList);

    let payload = users.map((user) =>
      buildUserDirectoryEntry(
        user,
        reservationStatsMap.get(user._id.toString()),
        orderStatsMap.get(user._id.toString()),
        ownerBillingMap.get(user._id.toString()),
        ownerComplexMap.get(user._id.toString()) || [],
      ),
    );

    if (req.query.billingStatus) {
      payload = payload.filter(
        (user) =>
          user.role === 'owner' &&
          user.ownerBilling &&
          user.ownerBilling.status === req.query.billingStatus,
      );
    }

    if (search) {
      payload = payload.filter((user) =>
        buildSearchPredicate(search, [
          user.displayName,
          user.email,
          user.role,
          user.ownerStatus,
          user.ownerBilling?.status,
          ...user.complexes.map((complex) => complex.name),
        ]),
      );
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo directorio de usuarios', error: error.message });
  }
};

// PATCH /api/users/:id/role
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ['client', 'owner', 'superadmin'];

    if (!allowed.includes(role)) {
      return res.status(400).json({ message: 'Rol invalido.' });
    }

    const user = await User.findById(req.params.id).select('-__v');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (user.role === 'superadmin' && role !== 'superadmin') {
      return res.status(400).json({ message: 'Un superadmin no puede deshabilitarse ni cambiar de rol.' });
    }

    user.role = role;
    user.ownerStatus = role === 'owner' ? 'PENDING' : null;
    user.ownerStatusNote = '';

    await user.save();
    res.json(await buildUserResponse(user, { createBillingIfMissing: false }));
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando rol', error: error.message });
  }
};

// PATCH /api/users/:id/approve
export const approveOwner = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'owner') {
      return res.status(400).json({ message: 'Solo se pueden aprobar cuentas con rol owner.' });
    }

    user.ownerStatus = 'APPROVED';
    user.ownerStatusNote = req.body.note || '';

    await user.save();
    res.json(await buildUserResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Error aprobando owner', error: error.message });
  }
};

// PATCH /api/users/:id/reject
export const rejectOwner = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'owner') {
      return res.status(400).json({ message: 'Solo se pueden rechazar cuentas con rol owner.' });
    }

    user.ownerStatus = 'REJECTED';
    user.ownerStatusNote = req.body.reason || '';

    await user.save();
    res.json(await buildUserResponse(user, { createBillingIfMissing: false }));
  } catch (error) {
    res.status(500).json({ message: 'Error rechazando owner', error: error.message });
  }
};
