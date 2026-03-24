import Reservation from '../models/Reservation.js';
import Court from '../models/Court.js';
import User from '../models/User.js';

// POST /api/reservations
export const createReservation = async (req, res) => {
  try {
    const { courtId, date, startTime, endTime } = req.body;
    
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const court = await Court.findById(courtId);
    if (!court) return res.status(404).json({ message: 'Cancha no encontrada' });

    // Cálculo basico del precio (asumiendo 1 hora por ahora)
    const totalPrice = court.pricePerHour; 

    // TODO: Agregar validación para evitar choque de horarios

    const newReservation = new Reservation({
      user: user._id,
      court: court._id,
      date,
      startTime,
      endTime,
      totalPrice
    });

    const savedReservation = await newReservation.save();
    res.status(201).json(savedReservation);
  } catch (error) {
    res.status(400).json({ message: 'Error creando la reserva', error: error.message });
  }
};

// GET /api/reservations/me
export const getUserReservations = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const reservations = await Reservation.find({ user: user._id }).populate('court');
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo reservas', error: error.message });
  }
};
