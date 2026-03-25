import Complex from '../models/Complex.js';
import Court from '../models/Court.js';
import Reservation from '../models/Reservation.js';

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
    });

    const saved = await reservation.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: 'Error creando la reserva', error: error.message });
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

    res.json({ takenHours: reservations.map((reservation) => reservation.startTime) });
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo slots', error: error.message });
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

export const getComplexReservations = async (req, res) => {
  try {
    const { complexId, date } = req.query;
    const filter = {};

    if (complexId) {
      await ensureOwnerOwnsComplex(complexId, req.dbUser);
      filter.complexId = complexId;
    }

    if (date) {
      filter.date = new Date(date);
    }

    const reservations = await Reservation.find(filter)
      .populate('court', 'name sport')
      .populate('user', 'displayName email')
      .sort({ date: 1, startTime: 1 });

    res.json(reservations);
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Error obteniendo reservas del complejo',
      error: error.message,
    });
  }
};
