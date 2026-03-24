import User from '../models/User.js';

// POST /api/users/register
// Solo permite el registro intencional
export const registerUser = async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user; // Firebase Auth
    const { displayName } = req.body; // Enviado desde el formulario (opcional)

    let user = await User.findOne({ uid });
    if (user) {
      return res.status(400).json({ message: 'El usuario ya se encuentra registrado.' });
    }

    user = new User({
      uid,
      email,
      displayName: displayName || name || email.split('@')[0],
      photoURL: picture,
      role: 'owner', // Por defecto los que se registran en el panel SaaS son dueños de complejo (o 'client' si fuese app pública)
    });
    
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error registrando usuario', error: error.message });
  }
};

// POST /api/users/login
// Falla estrictamente si el usuario no existe en la BD
export const loginUser = async (req, res) => {
  try {
    const { uid } = req.user; 

    const user = await User.findOne({ uid });

    if (!user) {
      return res.status(403).json({ 
        error: 'USER_NOT_REGISTERED', 
        message: 'Acceso denegado: Debes registrarte antes de iniciar sesión.' 
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error en el login', error: error.message });
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
