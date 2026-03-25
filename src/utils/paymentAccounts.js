import crypto from 'crypto';
import PaymentAccount from '../models/PaymentAccount.js';

const MP_API_BASE = 'https://api.mercadopago.com';

function normalizeString(value) {
  return String(value || '').trim();
}

function getEncryptionSecret() {
  return normalizeString(process.env.PAYMENT_ACCOUNT_ENCRYPTION_SECRET);
}

function getEncryptionKey() {
  const secret = getEncryptionSecret();
  if (!secret) {
    return null;
  }

  return crypto.createHash('sha256').update(secret).digest();
}

export function isPaymentAccountStorageReady() {
  return Boolean(getEncryptionKey());
}

function assertPaymentAccountStorageReady() {
  if (isPaymentAccountStorageReady()) {
    return;
  }

  const error = new Error('Falta PAYMENT_ACCOUNT_ENCRYPTION_SECRET para guardar credenciales de cobro.');
  error.status = 500;
  throw error;
}

function encryptSecret(value) {
  assertPaymentAccountStorageReady();

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString('base64')).join('.');
}

function decryptSecret(payload) {
  const key = getEncryptionKey();
  if (!payload || !key) {
    return '';
  }

  const [ivEncoded, tagEncoded, encryptedEncoded] = String(payload).split('.');
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    return '';
  }

  try {
    const iv = Buffer.from(ivEncoded, 'base64');
    const authTag = Buffer.from(tagEncoded, 'base64');
    const encrypted = Buffer.from(encryptedEncoded, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

async function fetchMercadoPagoUser(accessToken) {
  const response = await fetch(`${MP_API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
        data.error ||
        data.cause?.[0]?.description ||
        'No se pudieron validar las credenciales de Mercado Pago.',
    );
    error.status = 400;
    throw error;
  }

  return data;
}

function inferAccountMode(accessToken, publicKey) {
  const sample = `${normalizeString(accessToken)} ${normalizeString(publicKey)}`.toUpperCase();
  return sample.includes('TEST') ? 'sandbox' : 'production';
}

export function serializePaymentAccount(account) {
  if (!account) {
    return {
      provider: 'mercadopago',
      status: 'DISCONNECTED',
      publicKey: '',
      accessTokenLastFour: '',
      collectorId: '',
      collectorNickname: '',
      collectorEmail: '',
      mode: 'sandbox',
      reservationsEnabled: true,
      ordersEnabled: true,
      lastValidatedAt: null,
      lastValidationError: '',
      providerConfigured: false,
      secureStorageReady: isPaymentAccountStorageReady(),
    };
  }

  return {
    id: account._id,
    provider: account.provider,
    status: account.status,
    publicKey: account.publicKey,
    accessTokenLastFour: account.accessTokenLastFour,
    collectorId: account.collectorId,
    collectorNickname: account.collectorNickname,
    collectorEmail: account.collectorEmail,
    mode: account.mode,
    reservationsEnabled: account.reservationsEnabled,
    ordersEnabled: account.ordersEnabled,
    lastValidatedAt: account.lastValidatedAt,
    lastValidationError: account.lastValidationError,
    providerConfigured: Boolean(
      account.status === 'ACTIVE' && account.publicKey && account.encryptedAccessToken,
    ),
    secureStorageReady: isPaymentAccountStorageReady(),
  };
}

export async function getOwnerPaymentAccount(ownerId) {
  return PaymentAccount.findOne({ ownerId });
}

export async function getOwnerPaymentProvider(ownerId) {
  const account = await getOwnerPaymentAccount(ownerId);
  const serialized = serializePaymentAccount(account);

  if (!account || serialized.providerConfigured !== true) {
    return {
      configured: false,
      publicKey: '',
      accessToken: '',
      account,
      accountSummary: serialized,
    };
  }

  const decryptedAccessToken = decryptSecret(account.encryptedAccessToken);
  if (!decryptedAccessToken) {
    return {
      configured: false,
      publicKey: '',
      accessToken: '',
      account,
      accountSummary: {
        ...serialized,
        status: 'INVALID',
        providerConfigured: false,
        lastValidationError:
          serialized.lastValidationError || 'No se pudo leer el access token almacenado.',
      },
    };
  }

  return {
    configured: true,
    publicKey: account.publicKey,
    accessToken: decryptedAccessToken,
    account,
    accountSummary: serialized,
  };
}

export async function upsertOwnerPaymentAccount(ownerId, payload = {}) {
  const currentAccount = await getOwnerPaymentAccount(ownerId);
  const accessTokenInput = normalizeString(payload.accessToken);
  const publicKeyInput = normalizeString(payload.publicKey);

  const publicKey = publicKeyInput || normalizeString(currentAccount?.publicKey);
  const accessToken =
    accessTokenInput || decryptSecret(normalizeString(currentAccount?.encryptedAccessToken));

  if (!publicKey || !accessToken) {
    const error = new Error('Public Key y Access Token son requeridos para activar los cobros del complejo.');
    error.status = 400;
    throw error;
  }

  const mpUser = await fetchMercadoPagoUser(accessToken);

  const account = currentAccount || new PaymentAccount({ ownerId });
  account.publicKey = publicKey;
  account.encryptedAccessToken = accessTokenInput
    ? encryptSecret(accessTokenInput)
    : account.encryptedAccessToken;
  account.accessTokenLastFour = accessToken.slice(-4);
  account.collectorId = String(mpUser.id || '');
  account.collectorNickname = normalizeString(mpUser.nickname);
  account.collectorEmail = normalizeString(mpUser.email);
  account.mode = inferAccountMode(accessToken, publicKey);
  account.status = 'ACTIVE';
  account.reservationsEnabled =
    typeof payload.reservationsEnabled === 'boolean'
      ? payload.reservationsEnabled
      : account.reservationsEnabled;
  account.ordersEnabled =
    typeof payload.ordersEnabled === 'boolean' ? payload.ordersEnabled : account.ordersEnabled;
  account.lastValidatedAt = new Date();
  account.lastValidationError = '';

  await account.save();

  return account;
}
