import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // UID de Firebase
  email: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  photoURL: { type: String },
  role: { type: String, enum: ['superadmin', 'owner', 'client'], default: 'client' },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
