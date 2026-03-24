import mongoose from 'mongoose';

const complexSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String },
  logo: { type: String },
  openingHours: {
    start: { type: String, default: '08:00' },
    end: { type: String, default: '23:00' }
  },
  isActive: { type: Boolean, default: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.model('Complex', complexSchema);
