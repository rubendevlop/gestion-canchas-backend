import Complex from '../models/Complex.js';

export const createComplex = async (req, res) => {
  try {
    const { name, address, phone, logo, openingHours } = req.body;
    const ownerId = req.dbUser.role === 'superadmin' && req.body.ownerId
      ? req.body.ownerId : req.dbUser._id;
    const newComplex = new Complex({ name, address, phone, logo, openingHours, ownerId });
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
    if (req.query.active)  filter.isActive = req.query.active === 'true';
    const complexes = await Complex.find(filter).populate('ownerId', 'displayName email');
    res.json(complexes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener complejos', detail: error.message });
  }
};

export const getComplexById = async (req, res) => {
  try {
    const complex = await Complex.findById(req.params.id).populate('ownerId', 'displayName email');
    if (!complex) return res.status(404).json({ error: 'Complejo no encontrado' });
    res.json(complex);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el complejo', detail: error.message });
  }
};

// GET /api/complexes/mine → complejo del owner logueado
export const getMyComplex = async (req, res) => {
  try {
    const complex = await Complex.findOne({ ownerId: req.dbUser._id });
    if (!complex) return res.status(404).json({ error: 'No tenés ningún complejo configurado.' });
    // Agregar count de canchas
    const Court = (await import('../models/Court.js')).default;
    const courtsCount = await Court.countDocuments({ complexId: complex._id });
    res.json({ ...complex.toObject(), courtsCount });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tu complejo', detail: error.message });
  }
};

// PUT /api/complexes/:id
export const updateComplex = async (req, res) => {
  try {
    const complex = await Complex.findById(req.params.id);
    if (!complex) return res.status(404).json({ error: 'Complejo no encontrado' });
    if (req.dbUser.role !== 'superadmin' && complex.ownerId.toString() !== req.dbUser._id.toString()) {
      return res.status(403).json({ error: 'No tenés permiso para editar este complejo.' });
    }
    const { name, address, phone, logo, openingHours, isActive } = req.body;
    if (name         !== undefined) complex.name         = name;
    if (address      !== undefined) complex.address      = address;
    if (phone        !== undefined) complex.phone        = phone;
    if (logo         !== undefined) complex.logo         = logo;
    if (openingHours !== undefined) complex.openingHours = openingHours;
    if (isActive     !== undefined) complex.isActive     = isActive;
    await complex.save();
    res.json(complex);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el complejo', detail: error.message });
  }
};
