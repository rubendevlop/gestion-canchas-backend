import mongoose from 'mongoose';

const ownerBillingSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'ARS' },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    externalReference: { type: String, required: true, unique: true },
    dueDate: { type: Date },
    paidAt: { type: Date, default: null },
    accessStartsAt: { type: Date, default: null },
    accessEndsAt: { type: Date, default: null, index: true },
    checkoutUrl: { type: String, default: '' },
    checkoutSandboxUrl: { type: String, default: '' },
    mercadoPagoPreferenceId: { type: String, default: '' },
    mercadoPagoPaymentId: { type: String, default: '' },
    mercadoPagoStatus: { type: String, default: '' },
    mercadoPagoStatusDetail: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.model('OwnerBilling', ownerBillingSchema);
