import User from '../models/User.js';

// POST /api/users/sync
// Guarda o actualiza al usuario luego del login con Firebase
export const syncUser = async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user; // Viene del authMiddleware

    let user = await User.findOne({ uid });

    if (!user) {
      user = new User({
        uid,
        email,
        displayName: name || email.split('@')[0],
        photoURL: picture,
      });
      await user.save();
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error sincronizando usuario', error: error.message });
  }
};

// GET /api/users/me
// Obtiene el perfil actual
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo perfil', error: error.message });
  }
};
