import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  category: { type: String, required: true }, // ej: Bebidas, Snacks, Indumentaria, Equipamiento
  image: { type: String },
  complexId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complex', required: true }
}, { timestamps: true });

export default mongoose.model('Product', productSchema);
