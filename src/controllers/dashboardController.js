import Complex from '../models/Complex.js';
import Court from '../models/Court.js';
import Reservation from '../models/Reservation.js';
import Product from '../models/Product.js';

// GET /api/dashboard/stats
// Retorna métricas reales del complejo del owner logueado
export const getDashboardStats = async (req, res) => {
  try {
    const ownerId = req.dbUser._id;

    // Encontrar el complejo de este owner
    const complex = await Complex.findOne({ ownerId });
    if (!complex) {
      return res.json({
        hasComplex: false,
        message: 'No tenés ningún complejo configurado aún.',
      });
    }

    const complexId = complex._id;
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay   = new Date(today.setHours(23, 59, 59, 999));

    // Reservas de hoy
    const reservationsToday = await Reservation.find({
      complexId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'CANCELLED' },
    }).populate('user', 'displayName email').populate('court', 'name sport');

    // Ingresos de hoy (reservas confirmadas)
    const incomeToday = reservationsToday
      .filter((r) => r.status === 'CONFIRMED')
      .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

    // Total reservas del mes actual
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const totalThisMonth = await Reservation.countDocuments({
      complexId,
      date: { $gte: startOfMonth },
      status: { $ne: 'CANCELLED' },
    });

    // Canchas del complejo y tasa de ocupación hoy
    const courts = await Court.find({ complexId });
    const occupiedCourtIds = new Set(reservationsToday.map((r) => r.court?._id?.toString()));
    const availableCourts  = courts.filter((c) => !occupiedCourtIds.has(c._id.toString())).length;
    const occupancyRate    = courts.length > 0
      ? Math.round((occupiedCourtIds.size / courts.length) * 100)
      : 0;

    // Productos con stock crítico (menos de 5 unidades)
    const lowStockProducts = await Product.find({ complexId, stock: { $lt: 5 } }).select('name stock');

    res.json({
      hasComplex: true,
      complex: { _id: complex._id, name: complex.name },
      today: {
        reservations:    reservationsToday,
        income:          incomeToday,
        count:           reservationsToday.length,
        confirmedCount:  reservationsToday.filter((r) => r.status === 'CONFIRMED').length,
      },
      courts: {
        total:         courts.length,
        available:     availableCourts,
        occupied:      occupiedCourtIds.size,
        occupancyRate,
      },
      month: {
        totalReservations: totalThisMonth,
      },
      lowStock: lowStockProducts,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo estadísticas', detail: error.message });
  }
};
