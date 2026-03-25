import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  category: { type: String, required: true }, // ej: Bebidas, Snacks, Indumentaria, Equipamiento
  image: { type: String },
  imagePublicId: { type: String, default: '' },
  complexId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complex', required: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

productSchema.virtual('imageUrl').get(function imageUrl() {
  return this.image || '';
});

export default mongoose.model('Product', productSchema);
