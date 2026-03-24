import mongoose from 'mongoose';

const courtSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  sport: { type: String, required: true, enum: ['FUTBOL', 'PADEL', 'TENIS', 'BASKET'] },
  capacity: { type: Number, required: true },
  pricePerHour: { type: Number, required: true },
  isAvailable: { type: Boolean, default: true },
  images: [{ type: String }],
}, { timestamps: true });

export default mongoose.model('Court', courtSchema);
