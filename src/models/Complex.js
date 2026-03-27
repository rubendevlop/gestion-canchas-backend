import mongoose from 'mongoose';

const complexSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String },
  logo: { type: String, default: '' },
  logoPublicId: { type: String, default: '' },
  openingHours: {
    start: { type: String, default: '08:00' },
    end: { type: String, default: '23:00' }
  },
  isActive: { type: Boolean, default: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

complexSchema.virtual('imageUrl').get(function imageUrl() {
  return this.logo || '';
});

export default mongoose.model('Complex', complexSchema);
