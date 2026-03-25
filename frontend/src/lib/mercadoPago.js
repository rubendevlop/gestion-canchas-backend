import { initMercadoPago } from '@mercadopago/sdk-react';

const PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '';

let initializedPublicKey = '';

export function getMercadoPagoPublicKey(overrideKey = '') {
  return overrideKey || PUBLIC_KEY;
}

export function isMercadoPagoConfigured(overrideKey = '') {
  return Boolean(getMercadoPagoPublicKey(overrideKey));
}

export function ensureMercadoPago(overrideKey = '') {
  const publicKey = getMercadoPagoPublicKey(overrideKey);

  if (!publicKey) {
    return publicKey;
  }

  if (initializedPublicKey === publicKey) {
    return publicKey;
  }

  initMercadoPago(publicKey, {
    locale: 'es-AR',
  });
  initializedPublicKey = publicKey;
  return publicKey;
}
