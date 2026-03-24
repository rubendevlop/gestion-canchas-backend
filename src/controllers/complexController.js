import Complex from '../models/Complex.js';

export const createComplex = async (req, res) => {
  try {
    const { name, address, phone, logo, openingHours } = req.body;
    
    // Si es superadmin, podría asignar el complejo a otro ownerId. 
    // Si es owner, se asigna a sí mismo.
    const ownerId = req.dbUser.role === 'superadmin' && req.body.ownerId 
                      ? req.body.ownerId 
                      : req.dbUser._id;

    const newComplex = new Complex({
      name, address, phone, logo, openingHours, ownerId
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

    const complexes = await Complex.find(filter).populate('ownerId', 'name email');
    res.json(complexes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener complejos', detail: error.message });
  }
};

export const getComplexById = async (req, res) => {
  try {
    const complex = await Complex.findById(req.params.id).populate('ownerId', 'name email');
    if (!complex) return res.status(404).json({ error: 'Complejo no encontrado' });
    res.json(complex);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el complejo', detail: error.message });
  }
};
