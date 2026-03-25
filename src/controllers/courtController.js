import Court from '../models/Court.js';
import Complex from '../models/Complex.js';
import { assertComplexClientAccess } from '../utils/ownerBilling.js';

const assertOwner = (complex, dbUser) => {
  if (dbUser.role === 'superadmin') return;
  if (complex.ownerId.toString() !== dbUser._id.toString()) {
    const err = new Error('No tenés permiso sobre este complejo.'); err.status = 403; throw err;
  }
};

// GET /api/courts?complexId=X
export const getCourts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.complexId) filter.complexId = req.query.complexId;

     if (req.query.clientVisible === 'true' && req.query.complexId) {
      await assertComplexClientAccess(req.query.complexId, { createBillingIfMissing: true });
      filter.isAvailable = true;
    }

    const courts = await Court.find(filter);
    res.json(courts);
  } catch (error) {
    res.status(error.status || 500).json({ message: 'Error obteniendo las canchas', error: error.message });
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
    res.json(court);
  } catch (error) {
    res.status(error.status || 500).json({ message: 'Error obteniendo la cancha', error: error.message });
  }
};

// POST /api/courts
export const createCourt = async (req, res) => {
  try {
    const { name, sport, capacity, pricePerHour, description, complexId } = req.body;
    const complex = await Complex.findById(complexId);
    if (!complex) return res.status(404).json({ message: 'Complejo no encontrado' });
    assertOwner(complex, req.dbUser);

    const court = new Court({ name, sport, capacity, pricePerHour, description, complexId });
    await court.save();
    res.status(201).json(court);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message || 'Error creando la cancha' });
  }
};

// PUT /api/courts/:id
export const updateCourt = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id).populate('complexId');
    if (!court) return res.status(404).json({ message: 'Cancha no encontrada' });
    assertOwner(court.complexId, req.dbUser);

    const { name, sport, capacity, pricePerHour, description, isAvailable } = req.body;
    if (name !== undefined) court.name = name;
    if (sport !== undefined) court.sport = sport;
    if (capacity !== undefined) court.capacity = capacity;
    if (pricePerHour !== undefined) court.pricePerHour = pricePerHour;
    if (description !== undefined) court.description = description;
    if (isAvailable !== undefined) court.isAvailable = isAvailable;

    await court.save();
    res.json(court);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message || 'Error actualizando la cancha' });
  }
};

// DELETE /api/courts/:id
export const deleteCourt = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id).populate('complexId');
    if (!court) return res.status(404).json({ message: 'Cancha no encontrada' });
    assertOwner(court.complexId, req.dbUser);
    await court.deleteOne();
    res.json({ message: 'Cancha eliminada correctamente' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error eliminando la cancha' });
  }
};
