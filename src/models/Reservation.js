import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  court: { type: mongoose.Schema.Types.ObjectId, ref: 'Court', required: true },
  complexId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complex', required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true }, // formato HH:mm
  endTime: { type: String, required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'CANCELLED'], default: 'PENDING' },
  paymentStatus: { type: String, enum: ['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'], default: 'UNPAID' },
  externalReference: { type: String, default: '', index: true },
  mercadoPagoPreferenceId: { type: String, default: '', index: true },
  mercadoPagoOrderId: { type: String, default: '', index: true },
  mercadoPagoOrderStatus: { type: String, default: '' },
  mercadoPagoOrderStatusDetail: { type: String, default: '' },
  mercadoPagoPaymentId: { type: String, default: '' },
  mercadoPagoStatus: { type: String, default: '' },
  mercadoPagoStatusDetail: { type: String, default: '' },
  mercadoPagoPaymentMethodId: { type: String, default: '' },
  mercadoPagoPaymentMethodType: { type: String, default: '' },
  mercadoPagoRefundId: { type: String, default: '' },
  mercadoPagoRefundStatus: { type: String, default: '' },
  paidAt: { type: Date, default: null },
  refundedAt: { type: Date, default: null },
  refundAmount: { type: Number, default: 0 },
  confirmationEmailSentAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('Reservation', reservationSchema);
