import Complex from '../models/Complex.js';
import {
  buildMercadoPagoOAuthConnectUrl,
  buildMercadoPagoOAuthErrorRedirect,
  buildMercadoPagoOAuthSuccessRedirect,
  connectOwnerPaymentAccountWithOAuth,
  disconnectOwnerPaymentAccount,
  getMercadoPagoOAuthSetupSummary,
  getOwnerPaymentAccount,
  isPaymentAccountStorageReady,
  isMercadoPagoOAuthReady,
  serializePaymentAccount,
  updateOwnerPaymentAccountPreferences,
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
      oauthReady: isMercadoPagoOAuthReady(),
      oauthSetup: getMercadoPagoOAuthSetupSummary(),
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
    const account = await updateOwnerPaymentAccountPreferences(req.dbUser._id, req.body);

    res.json({
      message: 'Preferencias de cobro actualizadas correctamente.',
      account: serializePaymentAccount(account),
      secureStorageReady: isPaymentAccountStorageReady(),
      oauthReady: isMercadoPagoOAuthReady(),
      oauthSetup: getMercadoPagoOAuthSetupSummary(),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'No se pudo guardar la cuenta de cobro.',
      error: error.message,
    });
  }
};

export const getMercadoPagoConnectUrl = async (req, res) => {
  try {
    const data = await buildMercadoPagoOAuthConnectUrl(req.dbUser._id);
    res.json({
      ...data,
      oauthSetup: getMercadoPagoOAuthSetupSummary(),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'No se pudo iniciar la conexion con Mercado Pago.',
      error: error.message,
    });
  }
};

export const handleMercadoPagoOAuthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      throw new Error('Mercado Pago no devolvio el codigo de autorizacion.');
    }

    await connectOwnerPaymentAccountWithOAuth({
      code,
      state,
    });

    res.redirect(buildMercadoPagoOAuthSuccessRedirect());
  } catch (error) {
    const fallbackMessage = error.message || 'No se pudo vincular la cuenta de Mercado Pago.';
    res.redirect(buildMercadoPagoOAuthErrorRedirect(fallbackMessage));
  }
};

export const deleteCurrentOwnerPaymentAccount = async (req, res) => {
  try {
    const account = await disconnectOwnerPaymentAccount(req.dbUser._id);

    res.json({
      message: 'La cuenta de Mercado Pago fue desvinculada.',
      account: serializePaymentAccount(account),
      secureStorageReady: isPaymentAccountStorageReady(),
      oauthReady: isMercadoPagoOAuthReady(),
      oauthSetup: getMercadoPagoOAuthSetupSummary(),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'No se pudo desvincular la cuenta de cobro.',
      error: error.message,
    });
  }
};
