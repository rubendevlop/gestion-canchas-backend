import mongoose from 'mongoose';
import { DEFAULT_BOOKING_HOURS } from '../utils/bookingHours.js';

const courtSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  sport: { type: String, required: true, enum: ['FUTBOL', 'PADEL', 'TENIS', 'BASKET'] },
  capacity: { type: Number, required: true },
  pricePerHour: { type: Number, required: true },
  bookingHours: { type: [String], default: () => [...DEFAULT_BOOKING_HOURS] },
  isAvailable: { type: Boolean, default: true },
  image: { type: String, default: '' },
  imagePublicId: { type: String, default: '' },
  images: [{ type: String }],
  complexId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complex', required: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

courtSchema.virtual('imageUrl').get(function imageUrl() {
  return this.image || this.images?.[0] || '';
});

export default mongoose.model('Court', courtSchema);
