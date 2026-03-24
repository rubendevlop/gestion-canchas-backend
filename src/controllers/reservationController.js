import Reservation from '../models/Reservation.js';
import Court from '../models/Court.js';
import User from '../models/User.js';

// POST /api/reservations
export const createReservation = async (req, res) => {
  try {
    const { courtId, date, startTime } = req.body;

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const court = await Court.findById(courtId);
    if (!court) return res.status(404).json({ message: 'Cancha no encontrada' });

    // Verificar que el slot no esté ya tomado
    const dateObj = new Date(date);
    const clash = await Reservation.findOne({
      court: courtId,
      date: dateObj,
      startTime,
      status: { $ne: 'CANCELLED' },
    });
    if (clash) return res.status(409).json({ message: 'El horario ya está reservado.' });

    // Calcular endTime (+1h)
    const [h, m] = startTime.split(':').map(Number);
    const endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const newReservation = new Reservation({
      user: user._id,
      court: court._id,
      complexId: court.complexId,
      date: dateObj,
      startTime,
      endTime,
      totalPrice: court.pricePerHour,
      status: 'PENDING',
    });

    const saved = await newReservation.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: 'Error creando la reserva', error: error.message });
  }
};

// GET /api/reservations/mine  → reservas del usuario logueado
export const getMyReservations = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const reservations = await Reservation.find({ user: user._id })
      .populate('court', 'name sport pricePerHour complexId')
      .populate('complexId', 'name')
      .sort({ date: -1 });

    // Normalizar estado a minúsculas para el frontend
    const normalized = reservations.map((r) => ({
      ...r.toObject(),
      status: r.status.toLowerCase(),
    }));

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo reservas', error: error.message });
  }
};

// GET /api/reservations/taken?courtId=X&date=YYYY-MM-DD → horarios ya ocupados
export const getTakenSlots = async (req, res) => {
  try {
    const { courtId, date } = req.query;
    if (!courtId || !date) return res.status(400).json({ message: 'courtId y date son requeridos.' });

    const reservations = await Reservation.find({
      court: courtId,
      date: new Date(date),
      status: { $ne: 'CANCELLED' },
    }).select('startTime');

    res.json({ takenHours: reservations.map((r) => r.startTime) });
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo slots', error: error.message });
  }
};

// PATCH /api/reservations/:id/cancel
export const cancelReservation = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) return res.status(404).json({ message: 'Reserva no encontrada' });
    if (reservation.user.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado para cancelar esta reserva.' });
    }
    if (reservation.status === 'CANCELLED') {
      return res.status(400).json({ message: 'La reserva ya está cancelada.' });
    }

    reservation.status = 'CANCELLED';
    await reservation.save();
    res.json({ message: 'Reserva cancelada', reservation });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelando la reserva', error: error.message });
  }
};

// PATCH /api/reservations/:id/confirm → owner confirma reserva
export const confirmReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: 'Reserva no encontrada' });
    if (reservation.status === 'CANCELLED') return res.status(400).json({ message: 'No se puede confirmar una reserva cancelada.' });
    reservation.status = 'CONFIRMED';
    await reservation.save();
    res.json({ message: 'Reserva confirmada', reservation });
  } catch (error) {
    res.status(500).json({ message: 'Error confirmando la reserva', error: error.message });
  }
};

// GET /api/reservations → todas las del complejo (para el owner)
export const getComplexReservations = async (req, res) => {
  try {
    const { complexId, date } = req.query;
    const filter = {};
    if (complexId) filter.complexId = complexId;
    if (date) filter.date = new Date(date);

    const reservations = await Reservation.find(filter)
      .populate('court', 'name sport')
      .populate('user', 'displayName email')
      .sort({ date: 1, startTime: 1 });

    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo reservas del complejo', error: error.message });
  }
};

