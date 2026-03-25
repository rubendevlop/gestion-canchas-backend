import crypto from 'crypto';

const MP_API_BASE = 'https://api.mercadopago.com';

function normalizeUrl(value, fallback) {
  return (value || fallback || '').replace(/\/$/, '');
}

function isPublicHttpUrl(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    const hostname = String(parsed.hostname || '').toLowerCase();
    const isLocalHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local');

    return ['http:', 'https:'].includes(parsed.protocol) && !isLocalHost;
  } catch {
    return false;
  }
}

export function getFrontendUrl() {
  return normalizeUrl(process.env.FRONTEND_URL || process.env.APP_URL, 'http://localhost:5173');
}

export function getBackendUrl() {
  return normalizeUrl(process.env.BACKEND_PUBLIC_URL || process.env.API_URL, 'http://localhost:5000').replace(/\/api$/, '');
}

export function getMercadoPagoPublicKey() {
  return String(process.env.MERCADOPAGO_PUBLIC_KEY || '').trim();
}

export function getMercadoPagoAccessToken() {
  return String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
}

export function isMercadoPagoConfigured() {
  return Boolean(getMercadoPagoAccessToken() && getMercadoPagoPublicKey());
}

export async function mercadopagoRequest(path, options = {}, requestOptions = {}) {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) {
    throw new Error('Mercado Pago no esta configurado.');
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (requestOptions.idempotencyKey) {
    headers['X-Idempotency-Key'] = requestOptions.idempotencyKey;
  }

  const response = await fetch(`${MP_API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || data.cause?.[0]?.description || 'Mercado Pago rechazo la operacion.');
  }

  return data;
}

function inferPaymentType(paymentTypeId = '') {
  const normalized = String(paymentTypeId || '').toLowerCase();

  if (['credit_card', 'debit_card', 'prepaid_card'].includes(normalized)) {
    return normalized;
  }

  if (normalized.startsWith('deb')) {
    return 'debit_card';
  }

  if (normalized.startsWith('pre')) {
    return 'prepaid_card';
  }

  return 'credit_card';
}

export function buildOrderPaymentPayload(formData = {}, additionalData = {}, fallbackAmount = 0) {
  const amount = Number(formData.transaction_amount || fallbackAmount || 0);

  if (!formData.token) {
    throw new Error('Mercado Pago no genero el token de la tarjeta.');
  }

  if (!formData.payment_method_id) {
    throw new Error('Mercado Pago no informo el medio de pago.');
  }

  return {
    amount: Number(amount.toFixed(2)),
    payment_method: {
      id: String(formData.payment_method_id),
      type: inferPaymentType(additionalData.paymentTypeId || formData.payment_method_id),
      token: String(formData.token),
      installments: Math.max(1, Number(formData.installments) || 1),
    },
  };
}

export function buildWebhookUrl(pathname) {
  const backendUrl = getBackendUrl();
  if (!isPublicHttpUrl(backendUrl)) {
    return '';
  }

  return `${backendUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

export async function createAutomaticMercadoPagoOrder({
  externalReference,
  totalAmount,
  currency = 'ARS',
  description = '',
  payer = {},
  formData = {},
  additionalData = {},
  notificationPath,
}) {
  const payload = {
    type: 'online',
    processing_mode: 'automatic',
    external_reference: externalReference,
    total_amount: Number(Number(totalAmount || 0).toFixed(2)),
    currency,
    description,
    payer: {
      email: payer.email,
      ...(payer.identification ? { identification: payer.identification } : {}),
    },
    transactions: {
      payments: [buildOrderPaymentPayload(formData, additionalData, totalAmount)],
    },
  };

  if (notificationPath) {
    const notificationUrl = buildWebhookUrl(notificationPath);
    if (notificationUrl) {
      payload.notification_url = notificationUrl;
    }
  }

  return mercadopagoRequest(
    '/v1/orders',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    {
      idempotencyKey: `${externalReference}:${String(formData.token || '').slice(-16)}`,
    },
  );
}

export async function getMercadoPagoOrder(orderId) {
  return mercadopagoRequest(`/v1/orders/${orderId}`);
}

export function getPrimaryOrderPayment(order = {}) {
  return order?.transactions?.payments?.[0] || null;
}

export function getMercadoPagoOrderSnapshot(order = {}) {
  const payment = getPrimaryOrderPayment(order);

  return {
    orderId: String(order?.id || ''),
    orderStatus: String(order?.status || ''),
    orderStatusDetail: String(order?.status_detail || ''),
    paymentId: payment?.id ? String(payment.id) : '',
    paymentStatus: String(payment?.status || order?.status || ''),
    paymentStatusDetail: String(payment?.status_detail || order?.status_detail || ''),
    paymentMethodId: String(payment?.payment_method?.id || ''),
    paymentMethodType: String(payment?.payment_method?.type || ''),
    approvedAt:
      payment?.date_approved ||
      payment?.approved_at ||
      order?.processed_at ||
      order?.updated_at ||
      null,
  };
}

export function isApprovedMercadoPagoOrder(order = {}) {
  const snapshot = getMercadoPagoOrderSnapshot(order);
  const normalizedStatus = snapshot.paymentStatus.toLowerCase();
  const normalizedDetail = snapshot.paymentStatusDetail.toLowerCase();

  return (
    normalizedStatus === 'accredited' ||
    (normalizedStatus === 'processed' && ['accredited', 'approved'].includes(normalizedDetail))
  );
}

export function isPendingMercadoPagoOrder(order = {}) {
  const snapshot = getMercadoPagoOrderSnapshot(order);
  const normalizedStatus = snapshot.paymentStatus.toLowerCase();
  const normalizedDetail = snapshot.paymentStatusDetail.toLowerCase();

  return (
    ['created', 'pending', 'in_process', 'action_required', 'waiting_payment'].includes(normalizedStatus) ||
    ['waiting_payment', 'pending_review_manual', 'pending_contingency', 'in_process'].includes(normalizedDetail)
  );
}

export function isCancelledMercadoPagoOrder(order = {}) {
  const snapshot = getMercadoPagoOrderSnapshot(order);
  const normalizedStatus = snapshot.paymentStatus.toLowerCase();
  const normalizedDetail = snapshot.paymentStatusDetail.toLowerCase();

  return ['cancelled', 'canceled', 'expired'].includes(normalizedStatus) || ['cancelled', 'canceled', 'expired'].includes(normalizedDetail);
}

export function isFailedMercadoPagoOrder(order = {}) {
  if (isApprovedMercadoPagoOrder(order) || isPendingMercadoPagoOrder(order) || isCancelledMercadoPagoOrder(order)) {
    return false;
  }

  const snapshot = getMercadoPagoOrderSnapshot(order);
  const normalizedStatus = snapshot.paymentStatus.toLowerCase();
  const normalizedDetail = snapshot.paymentStatusDetail.toLowerCase();

  return Boolean(normalizedStatus || normalizedDetail);
}

function parseSignatureHeader(value = '') {
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const [key, rawValue] = entry.split('=', 2);
      if (key && rawValue) {
        acc[key] = rawValue;
      }
      return acc;
    }, {});
}

export function validateMercadoPagoWebhookSignature(req) {
  const secret = String(process.env.MERCADOPAGO_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return true;
  }

  const signatureHeader = req.headers['x-signature'] || req.headers['X-Signature'] || '';
  const requestId = req.headers['x-request-id'] || req.headers['X-Request-Id'] || '';
  const dataId =
    req.query?.['data.id'] ||
    req.query?.id ||
    req.body?.data?.id ||
    req.body?.id ||
    req.body?.resource?.split('/').pop() ||
    '';

  const signatureParts = parseSignatureHeader(signatureHeader);
  if (!signatureParts.ts || !signatureParts.v1 || !requestId || !dataId) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${signatureParts.ts};`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const providedSignature = String(signatureParts.v1);

  if (expectedSignature.length !== providedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature));
}

export function extractMercadoPagoOrderId(payload = {}) {
  return (
    payload?.data?.id ||
    payload?.id ||
    payload?.resource?.split('/').pop() ||
    payload?.query?.id ||
    payload?.query?.['data.id'] ||
    null
  );
}
