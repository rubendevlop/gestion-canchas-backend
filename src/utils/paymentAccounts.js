import crypto from 'crypto';
import PaymentAccount from '../models/PaymentAccount.js';
import { getBackendUrl, getFrontendUrl } from './mercadoPago.js';

const MP_API_BASE = 'https://api.mercadopago.com';
const MP_OAUTH_BASE = 'https://auth.mercadopago.com.ar/authorization';
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function getEncryptionSecret() {
  return normalizeString(process.env.PAYMENT_ACCOUNT_ENCRYPTION_SECRET);
}

function getOAuthStateSecret() {
  return normalizeString(process.env.MERCADOPAGO_OAUTH_STATE_SECRET) || getEncryptionSecret();
}

function getMercadoPagoClientId() {
  return normalizeString(process.env.MERCADOPAGO_CLIENT_ID);
}

function getMercadoPagoClientSecret() {
  return normalizeString(process.env.MERCADOPAGO_CLIENT_SECRET);
}

function getMercadoPagoOAuthAuthorizationBase() {
  const configured = normalizeString(process.env.MERCADOPAGO_OAUTH_AUTH_URL);
  if (!configured) {
    return MP_OAUTH_BASE;
  }

  try {
    return new URL(configured).toString();
  } catch {
    return MP_OAUTH_BASE;
  }
}

function isMercadoPagoOAuthPkceEnabled() {
  const configured = normalizeString(process.env.MERCADOPAGO_OAUTH_USE_PKCE).toLowerCase();
  if (!configured) {
    return true;
  }

  return !['0', 'false', 'no', 'off'].includes(configured);
}

function isPublicHttpUrl(value = '') {
  const normalized = normalizeString(value);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    const hostname = normalizeString(parsed.hostname).toLowerCase();
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local');

    return ['http:', 'https:'].includes(parsed.protocol) && !isLocal;
  } catch {
    return false;
  }
}

function getMercadoPagoOAuthReadiness() {
  const storageReady = isPaymentAccountStorageReady();
  const oauthStateSecret = Boolean(getOAuthStateSecret());
  const clientId = Boolean(getMercadoPagoClientId());
  const clientSecret = Boolean(getMercadoPagoClientSecret());
  const backendUrl = getBackendUrl();
  const frontendUrl = getFrontendUrl();
  const backendPublicUrl = isPublicHttpUrl(backendUrl);
  const frontendPublicUrl = isPublicHttpUrl(frontendUrl);

  return {
    storageReady,
    oauthStateSecret,
    clientId,
    clientSecret,
    backendPublicUrl,
    frontendPublicUrl,
    backendUrl,
    frontendUrl,
  };
}

export function isPaymentAccountStorageReady() {
  return Boolean(getEncryptionKey());
}

export function isMercadoPagoOAuthReady() {
  const readiness = getMercadoPagoOAuthReadiness();
  return Boolean(
    readiness.storageReady &&
      readiness.oauthStateSecret &&
      readiness.clientId &&
      readiness.clientSecret &&
      readiness.backendPublicUrl &&
      readiness.frontendPublicUrl,
  );
}

function getEncryptionKey() {
  const secret = getEncryptionSecret();
  if (!secret) {
    return null;
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function assertPaymentAccountStorageReady() {
  if (isPaymentAccountStorageReady()) {
    return;
  }

  const error = new Error('Falta PAYMENT_ACCOUNT_ENCRYPTION_SECRET para guardar la vinculacion de cobro.');
  error.status = 500;
  throw error;
}

function assertMercadoPagoOAuthReady() {
  if (isMercadoPagoOAuthReady()) {
    return;
  }

  const readiness = getMercadoPagoOAuthReadiness();
  const missing = [];

  if (!readiness.clientId) missing.push('MERCADOPAGO_CLIENT_ID');
  if (!readiness.clientSecret) missing.push('MERCADOPAGO_CLIENT_SECRET');
  if (!readiness.storageReady) missing.push('PAYMENT_ACCOUNT_ENCRYPTION_SECRET');
  if (!readiness.oauthStateSecret) missing.push('MERCADOPAGO_OAUTH_STATE_SECRET o PAYMENT_ACCOUNT_ENCRYPTION_SECRET');
  if (!readiness.backendPublicUrl) missing.push('BACKEND_PUBLIC_URL (URL publica, no localhost)');
  if (!readiness.frontendPublicUrl) missing.push('FRONTEND_URL (URL publica, no localhost)');

  const error = new Error(
    `Faltan variables para conectar Mercado Pago: ${missing.join(', ')}.`,
  );
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

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}

function signPayload(payload) {
  return crypto.createHmac('sha256', getOAuthStateSecret()).update(payload).digest('base64url');
}

function createCodeVerifier() {
  return crypto.randomBytes(64).toString('base64url');
}

function createCodeChallenge(codeVerifier) {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

function createOAuthState(ownerId) {
  const payload = JSON.stringify({
    ownerId: String(ownerId),
    codeVerifier: createCodeVerifier(),
    issuedAt: Date.now(),
  });

  const encodedPayload = toBase64Url(payload);
  const signature = signPayload(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    payload: JSON.parse(payload),
  };
}

function readOAuthState(stateToken) {
  const [encodedPayload, signature] = String(stateToken || '').split('.');
  if (!encodedPayload || !signature) {
    const error = new Error('No se pudo validar el estado de la conexion con Mercado Pago.');
    error.status = 400;
    throw error;
  }

  const expectedSignature = signPayload(encodedPayload);
  if (expectedSignature.length !== signature.length) {
    const error = new Error('La firma de la conexion con Mercado Pago es invalida.');
    error.status = 400;
    throw error;
  }

  const valid = crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  if (!valid) {
    const error = new Error('La firma de la conexion con Mercado Pago es invalida.');
    error.status = 400;
    throw error;
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8'));
  } catch {
    const error = new Error('No se pudo leer el estado de la conexion con Mercado Pago.');
    error.status = 400;
    throw error;
  }

  if (!payload?.ownerId || !payload?.codeVerifier || !payload?.issuedAt) {
    const error = new Error('El estado de la conexion con Mercado Pago esta incompleto.');
    error.status = 400;
    throw error;
  }

  if (Date.now() - Number(payload.issuedAt) > OAUTH_STATE_TTL_MS) {
    const error = new Error('La conexion con Mercado Pago vencio. Inicia el proceso nuevamente.');
    error.status = 400;
    throw error;
  }

  return payload;
}

function getMercadoPagoOAuthRedirectUri() {
  const backendUrl = getBackendUrl();
  if (!isPublicHttpUrl(backendUrl)) {
    return '';
  }

  return `${backendUrl}/api/payment-account/oauth/callback`;
}

export function getMercadoPagoOAuthSetupSummary() {
  const readiness = getMercadoPagoOAuthReadiness();

  return {
    provider: 'mercadopago',
    authType: 'oauth',
    requiredIntegrationModel: 'Marketplace / Split Payments',
    authorizationBaseUrl: getMercadoPagoOAuthAuthorizationBase(),
    redirectUri: getMercadoPagoOAuthRedirectUri(),
    pkceEnabled: isMercadoPagoOAuthPkceEnabled(),
    backendUrl: readiness.backendUrl,
    frontendUrl: readiness.frontendUrl,
    readiness: {
      secureStorageReady: readiness.storageReady,
      oauthStateSecretReady: readiness.oauthStateSecret,
      clientIdReady: readiness.clientId,
      clientSecretReady: readiness.clientSecret,
      backendPublicUrlReady: readiness.backendPublicUrl,
      frontendPublicUrlReady: readiness.frontendPublicUrl,
    },
  };
}

function getFrontendCollectionsUrl(params = {}) {
  const frontendUrl = getFrontendUrl();
  const destination = new URL('/dashboard/collections', frontendUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      destination.searchParams.set(key, String(value));
    }
  });

  return destination.toString();
}

async function mercadoPagoOAuthRequest(params) {
  const response = await fetch(`${MP_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
        data.error_description ||
        data.error ||
        data.cause?.[0]?.description ||
        'Mercado Pago no pudo completar la vinculacion.',
    );
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
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
        'No se pudo validar la cuenta de Mercado Pago.',
    );
    error.status = response.status || 400;
    throw error;
  }

  return data;
}

function inferAccountMode(tokenResponse = {}) {
  if (typeof tokenResponse.live_mode === 'boolean') {
    return tokenResponse.live_mode ? 'production' : 'sandbox';
  }

  const sample = `${normalizeString(tokenResponse.access_token)} ${normalizeString(tokenResponse.public_key)}`.toUpperCase();
  return sample.includes('TEST') ? 'sandbox' : 'production';
}

function buildTokenExpiryDate(expiresIn) {
  const seconds = Number(expiresIn || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000);
}

function shouldRefreshOAuthToken(account) {
  if (!account || account.authType !== 'oauth' || account.status !== 'ACTIVE') {
    return false;
  }

  if (!account.tokenExpiresAt || !account.encryptedRefreshToken) {
    return false;
  }

  return new Date(account.tokenExpiresAt).getTime() - Date.now() <= TOKEN_REFRESH_BUFFER_MS;
}

async function refreshOAuthToken(account) {
  const refreshToken = decryptSecret(account.encryptedRefreshToken);
  if (!refreshToken) {
    return account;
  }

  try {
    const tokenResponse = await mercadoPagoOAuthRequest({
      grant_type: 'refresh_token',
      client_id: getMercadoPagoClientId(),
      client_secret: getMercadoPagoClientSecret(),
      refresh_token: refreshToken,
    });

    const mpUser = await fetchMercadoPagoUser(tokenResponse.access_token);
    applyTokenResponseToAccount(account, tokenResponse, mpUser);
    account.lastValidatedAt = new Date();
    account.lastValidationError = '';
    await account.save();
  } catch (error) {
    account.lastValidationError = error.message || 'No se pudo renovar la conexion con Mercado Pago.';

    if ([400, 401].includes(error.status)) {
      account.status = 'INVALID';
    }

    await account.save();
  }

  return account;
}

function applyTokenResponseToAccount(account, tokenResponse, mpUser) {
  const accessToken = normalizeString(tokenResponse.access_token);
  const refreshToken = normalizeString(tokenResponse.refresh_token);
  const publicKey = normalizeString(tokenResponse.public_key);

  if (!accessToken || !publicKey) {
    const error = new Error('Mercado Pago no devolvio los datos necesarios para activar la cuenta.');
    error.status = 400;
    throw error;
  }

  account.authType = 'oauth';
  account.publicKey = publicKey;
  account.encryptedAccessToken = encryptSecret(accessToken);
  account.accessTokenLastFour = accessToken.slice(-4);
  account.encryptedRefreshToken = refreshToken ? encryptSecret(refreshToken) : account.encryptedRefreshToken;
  account.refreshTokenLastFour = refreshToken ? refreshToken.slice(-4) : account.refreshTokenLastFour;
  account.collectorId = normalizeString(tokenResponse.user_id || mpUser?.id);
  account.collectorNickname = normalizeString(mpUser?.nickname);
  account.collectorEmail = normalizeString(mpUser?.email);
  account.mode = inferAccountMode(tokenResponse);
  account.tokenExpiresAt = buildTokenExpiryDate(tokenResponse.expires_in);
  account.oauthAuthorizedAt = new Date();
  account.status = 'ACTIVE';
}

export function serializePaymentAccount(account) {
  const base = {
    provider: 'mercadopago',
    status: 'DISCONNECTED',
    authType: 'oauth',
    publicKey: '',
    accessTokenLastFour: '',
    refreshTokenLastFour: '',
    collectorId: '',
    collectorNickname: '',
    collectorEmail: '',
    mode: 'sandbox',
    tokenExpiresAt: null,
    oauthAuthorizedAt: null,
    reservationsEnabled: true,
    ordersEnabled: true,
    lastValidatedAt: null,
    lastValidationError: '',
    providerConfigured: false,
    secureStorageReady: isPaymentAccountStorageReady(),
    oauthReady: isMercadoPagoOAuthReady(),
  };

  if (!account) {
    return base;
  }

  return {
    id: account._id,
    provider: account.provider,
    status: account.status,
    authType: account.authType || 'oauth',
    publicKey: account.publicKey,
    accessTokenLastFour: account.accessTokenLastFour,
    refreshTokenLastFour: account.refreshTokenLastFour,
    collectorId: account.collectorId,
    collectorNickname: account.collectorNickname,
    collectorEmail: account.collectorEmail,
    mode: account.mode,
    tokenExpiresAt: account.tokenExpiresAt,
    oauthAuthorizedAt: account.oauthAuthorizedAt,
    reservationsEnabled: account.reservationsEnabled,
    ordersEnabled: account.ordersEnabled,
    lastValidatedAt: account.lastValidatedAt,
    lastValidationError: account.lastValidationError,
    providerConfigured: Boolean(
      account.status === 'ACTIVE' && account.publicKey && account.encryptedAccessToken,
    ),
    secureStorageReady: isPaymentAccountStorageReady(),
    oauthReady: isMercadoPagoOAuthReady(),
  };
}

export async function getOwnerPaymentAccount(ownerId) {
  return PaymentAccount.findOne({ ownerId });
}

async function ensureOwnerPaymentAccount(ownerId) {
  const existing = await getOwnerPaymentAccount(ownerId);
  if (existing) {
    return existing;
  }

  const account = new PaymentAccount({ ownerId });
  await account.save();
  return account;
}

export async function getOwnerPaymentProvider(ownerId) {
  let account = await getOwnerPaymentAccount(ownerId);

  if (!account) {
    return {
      configured: false,
      publicKey: '',
      accessToken: '',
      account: null,
      accountSummary: serializePaymentAccount(null),
    };
  }

  if (shouldRefreshOAuthToken(account)) {
    account = await refreshOAuthToken(account);
  }

  const serialized = serializePaymentAccount(account);

  if (serialized.providerConfigured !== true) {
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
    account.status = 'INVALID';
    account.lastValidationError = 'No se pudo leer el token de Mercado Pago almacenado.';
    await account.save();

    return {
      configured: false,
      publicKey: '',
      accessToken: '',
      account,
      accountSummary: serializePaymentAccount(account),
    };
  }

  const inferredMode = inferAccountMode({
    access_token: decryptedAccessToken,
    public_key: account.publicKey,
  });

  if (account.mode !== inferredMode) {
    account.mode = inferredMode;
    await account.save();
  }

  const normalizedSummary = serializePaymentAccount(account);

  return {
    configured: true,
    publicKey: account.publicKey,
    accessToken: decryptedAccessToken,
    account,
    accountSummary: normalizedSummary,
  };
}

export async function updateOwnerPaymentAccountPreferences(ownerId, payload = {}) {
  const account = await ensureOwnerPaymentAccount(ownerId);
  account.reservationsEnabled = normalizeBoolean(payload.reservationsEnabled, account.reservationsEnabled);
  account.ordersEnabled = normalizeBoolean(payload.ordersEnabled, account.ordersEnabled);
  await account.save();
  return account;
}

export async function disconnectOwnerPaymentAccount(ownerId) {
  const account = await ensureOwnerPaymentAccount(ownerId);
  account.status = 'DISCONNECTED';
  account.authType = 'oauth';
  account.publicKey = '';
  account.encryptedAccessToken = '';
  account.encryptedRefreshToken = '';
  account.accessTokenLastFour = '';
  account.refreshTokenLastFour = '';
  account.collectorId = '';
  account.collectorNickname = '';
  account.collectorEmail = '';
  account.mode = 'sandbox';
  account.tokenExpiresAt = null;
  account.oauthAuthorizedAt = null;
  account.lastValidatedAt = null;
  account.lastValidationError = '';
  await account.save();
  return account;
}

export async function buildMercadoPagoOAuthConnectUrl(ownerId) {
  assertMercadoPagoOAuthReady();

  const redirectUri = getMercadoPagoOAuthRedirectUri();
  const state = createOAuthState(ownerId);
  const usePkce = isMercadoPagoOAuthPkceEnabled();
  const challenge = usePkce ? createCodeChallenge(state.payload.codeVerifier) : '';

  const authorizationUrl = new URL(getMercadoPagoOAuthAuthorizationBase());
  authorizationUrl.searchParams.set('client_id', getMercadoPagoClientId());
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('platform_id', 'mp');
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('state', state.token);
  if (usePkce) {
    authorizationUrl.searchParams.set('code_challenge', challenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  }

  return {
    authorizationUrl: authorizationUrl.toString(),
    redirectUri,
  };
}

export async function connectOwnerPaymentAccountWithOAuth({ code, state }) {
  assertMercadoPagoOAuthReady();

  const oauthState = readOAuthState(state);
  const tokenRequest = {
    grant_type: 'authorization_code',
    client_id: getMercadoPagoClientId(),
    client_secret: getMercadoPagoClientSecret(),
    code: normalizeString(code),
    redirect_uri: getMercadoPagoOAuthRedirectUri(),
  };

  if (isMercadoPagoOAuthPkceEnabled()) {
    tokenRequest.code_verifier = oauthState.codeVerifier;
  }

  const tokenResponse = await mercadoPagoOAuthRequest(tokenRequest);

  const mpUser = await fetchMercadoPagoUser(tokenResponse.access_token);
  const account = await ensureOwnerPaymentAccount(oauthState.ownerId);
  applyTokenResponseToAccount(account, tokenResponse, mpUser);
  account.lastValidatedAt = new Date();
  account.lastValidationError = '';
  await account.save();

  return {
    ownerId: oauthState.ownerId,
    account,
  };
}

export function buildMercadoPagoOAuthSuccessRedirect() {
  return getFrontendCollectionsUrl({ mp: 'connected' });
}

export function buildMercadoPagoOAuthErrorRedirect(message) {
  return getFrontendCollectionsUrl({ mp: 'error', message });
}
