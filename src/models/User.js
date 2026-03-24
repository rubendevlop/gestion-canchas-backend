import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  uid:         { type: String, required: true, unique: true },
  email:       { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  photoURL:    { type: String },
  role:        { type: String, enum: ['superadmin', 'owner', 'client'], default: 'client' },

  // Solo para role === 'owner':
  // PENDING  → recién registrado, esperando aprobación del superadmin
  // APPROVED → aprobado, puede usar el dashboard
  // REJECTED → rechazado
  ownerStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: null,
  },

  // Nota opcional del superadmin al aprobar/rechazar
  ownerStatusNote: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
