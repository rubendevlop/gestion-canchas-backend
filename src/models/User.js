import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  uid:         { type: String, required: true, unique: true },
  email:       { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  photoURL:    { type: String },
  phone:       { type: String, default: '' },
  role:        { type: String, enum: ['superadmin', 'owner', 'client'], default: 'client' },
  ownerApplication: {
    fullName: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    documentType: { type: String, default: '' },
    documentNumber: { type: String, default: '' },
    complexName: { type: String, default: '' },
    complexAddress: { type: String, default: '' },
    city: { type: String, default: '' },
    courtsCount: { type: Number, default: 0 },
    sportsOffered: { type: String, default: '' },
    websiteOrInstagram: { type: String, default: '' },
    notes: { type: String, default: '' },
    submittedAt: { type: Date, default: null },
  },

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
