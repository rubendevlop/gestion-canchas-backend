import mongoose from 'mongoose';

const paymentAccountSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['mercadopago'],
      default: 'mercadopago',
    },
    status: {
      type: String,
      enum: ['DISCONNECTED', 'ACTIVE', 'INVALID'],
      default: 'DISCONNECTED',
      index: true,
    },
    publicKey: { type: String, default: '' },
    encryptedAccessToken: { type: String, default: '' },
    accessTokenLastFour: { type: String, default: '' },
    collectorId: { type: String, default: '' },
    collectorNickname: { type: String, default: '' },
    collectorEmail: { type: String, default: '' },
    mode: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'sandbox',
    },
    reservationsEnabled: { type: Boolean, default: true },
    ordersEnabled: { type: Boolean, default: true },
    lastValidatedAt: { type: Date, default: null },
    lastValidationError: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.model('PaymentAccount', paymentAccountSchema);
