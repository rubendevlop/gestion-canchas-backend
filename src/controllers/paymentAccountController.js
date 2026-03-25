import Complex from '../models/Complex.js';
import {
  getOwnerPaymentAccount,
  isPaymentAccountStorageReady,
  serializePaymentAccount,
  upsertOwnerPaymentAccount,
} from '../utils/paymentAccounts.js';

function serializeComplex(complex) {
  return {
    _id: complex._id,
    name: complex.name,
    isActive: complex.isActive,
  };
}

export const getCurrentOwnerPaymentAccount = async (req, res) => {
  try {
    const [account, complexes] = await Promise.all([
      getOwnerPaymentAccount(req.dbUser._id),
      Complex.find({ ownerId: req.dbUser._id }).select('name isActive').lean(),
    ]);

    res.json({
      account: serializePaymentAccount(account),
      complexes: complexes.map(serializeComplex),
      secureStorageReady: isPaymentAccountStorageReady(),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'No se pudo obtener la cuenta de cobro.',
      error: error.message,
    });
  }
};

export const updateCurrentOwnerPaymentAccount = async (req, res) => {
  try {
    const account = await upsertOwnerPaymentAccount(req.dbUser._id, req.body);

    res.json({
      message: 'Cuenta de Mercado Pago validada y guardada correctamente.',
      account: serializePaymentAccount(account),
      secureStorageReady: isPaymentAccountStorageReady(),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'No se pudo guardar la cuenta de cobro.',
      error: error.message,
    });
  }
};
