import Court from '../models/Court.js';

// GET /api/courts
export const getCourts = async (req, res) => {
  try {
    const courts = await Court.find();
    res.json(courts);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo las canchas', error: error.message });
  }
};

// POST /api/courts
export const createCourt = async (req, res) => {
  try {
    const newCourt = new Court(req.body);
    const savedCourt = await newCourt.save();
    res.status(201).json(savedCourt);
  } catch (error) {
    res.status(400).json({ message: 'Error creando la cancha', error: error.message });
  }
};
