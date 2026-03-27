import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  complexId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complex', required: true },
  externalReference: { type: String, required: true, index: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' },
    quantity: { type: Number, default: 1 },
    price: { type: Number, required: true } // Snapshot del precio en el momento de la compra
  }],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending' },
  mercadoPagoPaymentId: { type: String },
  mercadoPagoPreferenceId: { type: String },
  mercadoPagoOrderId: { type: String, index: true },
  mercadoPagoOrderStatus: { type: String, default: '' },
  mercadoPagoOrderStatusDetail: { type: String, default: '' },
  mercadoPagoStatus: { type: String, default: '' },
  mercadoPagoStatusDetail: { type: String, default: '' },
  mercadoPagoPaymentMethodId: { type: String, default: '' },
  mercadoPagoPaymentMethodType: { type: String, default: '' },
  paidAt: { type: Date, default: null },
  confirmationEmailSentAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
