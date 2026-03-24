import User from '../models/User.js';

// POST /api/users/register
// Solo permite el registro intencional
export const registerUser = async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user; // Firebase Auth
    const { displayName } = req.body || {}; // Enviado desde el formulario (seguro frente a undefined)

    let user = await User.findOne({ uid });
    if (user) {
      return res.status(400).json({ message: 'El usuario ya se encuentra registrado.' });
    }

    user = new User({
      uid,
      email,
      displayName: displayName || name || email.split('@')[0],
      photoURL: picture,
      // Solo 'client' u 'owner' pueden auto-asignarse. 'superadmin' se asigna manualmente.
      role: req.body.registerAs === 'owner' ? 'owner' : 'client',
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

// GET /api/users  → Solo superadmin
export const listUsers = async (req, res) => {
  try {
    const users = await User.find().select('-__v').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error listando usuarios', error: error.message });
  }
};

// PATCH /api/users/:id/role  → Solo superadmin
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ['client', 'owner', 'superadmin'];
    if (!allowed.includes(role)) {
      return res.status(400).json({ message: 'Rol inválido.' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-__v');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando rol', error: error.message });
  }
};
