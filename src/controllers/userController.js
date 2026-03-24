import User from '../models/User.js';
import { resolveDbUser } from '../utils/resolveDbUser.js';

// POST /api/users/register
export const registerUser = async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user;
    const { displayName } = req.body || {};

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
      ownerStatus: req.body.registerAs === 'owner' ? 'PENDING' : null,
    });

    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error registrando usuario', error: error.message });
  }
};

// POST /api/users/login
export const loginUser = async (req, res) => {
  try {
    const user = await resolveDbUser(req.user);

    if (!user) {
      return res.status(403).json({
        error: 'USER_NOT_REGISTERED',
        message: 'Acceso denegado: Debes registrarte antes de iniciar sesion.',
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error en el login', error: error.message });
  }
};

// GET /api/users/me
export const getCurrentUser = async (req, res) => {
  try {
    const user = await resolveDbUser(req.user);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo perfil', error: error.message });
  }
};

// GET /api/users
export const listUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.ownerStatus) filter.ownerStatus = req.query.ownerStatus;

    const users = await User.find(filter).select('-__v').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error listando usuarios', error: error.message });
  }
};

// PATCH /api/users/:id/role
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ['client', 'owner', 'superadmin'];

    if (!allowed.includes(role)) {
      return res.status(400).json({ message: 'Rol invalido.' });
    }

    const user = await User.findById(req.params.id).select('-__v');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (user.role === 'superadmin' && role !== 'superadmin') {
      return res.status(400).json({ message: 'Un superadmin no puede deshabilitarse ni cambiar de rol.' });
    }

    user.role = role;
    user.ownerStatus = role === 'owner' ? 'PENDING' : null;
    user.ownerStatusNote = '';

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando rol', error: error.message });
  }
};

// PATCH /api/users/:id/approve
export const approveOwner = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'owner') {
      return res.status(400).json({ message: 'Solo se pueden aprobar cuentas con rol owner.' });
    }

    user.ownerStatus = 'APPROVED';
    user.ownerStatusNote = req.body.note || '';

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error aprobando owner', error: error.message });
  }
};

// PATCH /api/users/:id/reject
export const rejectOwner = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'owner') {
      return res.status(400).json({ message: 'Solo se pueden rechazar cuentas con rol owner.' });
    }

    user.ownerStatus = 'REJECTED';
    user.ownerStatusNote = req.body.reason || '';

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error rechazando owner', error: error.message });
  }
};
