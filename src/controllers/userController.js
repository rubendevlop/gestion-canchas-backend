import User from '../models/User.js';
import { resolveDbUser } from '../utils/resolveDbUser.js';

// POST /api/users/register
// Solo permite el registro intencional
export const registerUser = async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user; // Firebase Auth
    const { displayName } = req.body || {}; // Enviado desde el formulario (seguro frente a undefined)

    let user = await User.findOne({ $or: [{ uid }, { email }] });
    if (user) {
      return res.status(400).json({ message: 'El usuario ya se encuentra registrado.' });
    }

    user = new User({
      uid,
      email,
      displayName: displayName || name || email.split('@')[0],
      photoURL: picture,
      role: req.body.registerAs === 'owner' ? 'owner' : 'client',
      // Los owners quedan PENDING hasta aprobación del superadmin
      ownerStatus: req.body.registerAs === 'owner' ? 'PENDING' : null,
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
    const user = await resolveDbUser(req.user);

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
    const user = await resolveDbUser(req.user);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo perfil', error: error.message });
  }
};

// GET /api/users  → Solo superadmin
export const listUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.role)        filter.role        = req.query.role;
    if (req.query.ownerStatus) filter.ownerStatus = req.query.ownerStatus;
    const users = await User.find(filter).select('-__v').sort({ createdAt: -1 });
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
      { role, ownerStatus: role === 'owner' ? 'PENDING' : null, ownerStatusNote: '' },
      { new: true, runValidators: true }
    ).select('-__v');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando rol', error: error.message });
  }
};

// PATCH /api/users/:id/approve  → Solo superadmin
export const approveOwner = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'owner') return res.status(400).json({ message: 'Solo se pueden aprobar cuentas con rol owner.' });
    user.ownerStatus = 'APPROVED';
    user.ownerStatusNote = req.body.note || '';
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error aprobando owner', error: error.message });
  }
};

// PATCH /api/users/:id/reject  → Solo superadmin
export const rejectOwner = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'owner') return res.status(400).json({ message: 'Solo se pueden rechazar cuentas con rol owner.' });
    user.ownerStatus = 'REJECTED';
    user.ownerStatusNote = req.body.reason || '';
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error rechazando owner', error: error.message });
  }
};
