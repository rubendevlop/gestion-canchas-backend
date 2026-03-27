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

export function getMercadoPagoAccessToken(overrideToken = '') {
  return String(overrideToken || process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
}

export function getMercadoPagoTestPayerEmail() {
  return String(process.env.MERCADOPAGO_TEST_PAYER_EMAIL || '').trim();
}

export function resolveMercadoPagoPayerEmail({
  requestedEmail = '',
  fallbackEmail = '',
  providerMode = '',
} = {}) {
  const configuredTestEmail = getMercadoPagoTestPayerEmail();
  const normalizedMode = String(providerMode || '').trim().toLowerCase();
  const requiresTestUser = normalizedMode === 'sandbox';

  if (configuredTestEmail && requiresTestUser) {
    return {
      email: configuredTestEmail,
      usesConfiguredTestEmail: true,
      requiresTestUser,
    };
  }

  return {
    email: String(requestedEmail || '').trim() || String(fallbackEmail || '').trim(),
    usesConfiguredTestEmail: false,
    requiresTestUser,
  };
}

export function isMercadoPagoConfigured() {
  return Boolean(getMercadoPagoAccessToken() && getMercadoPagoPublicKey());
}

function sanitizeMercadoPagoBodyForLog(body) {
  if (!body) {
    return null;
  }

  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    const payments = Array.isArray(parsed?.transactions?.payments) ? parsed.transactions.payments : [];

    return {
      type: parsed?.type,
      processing_mode: parsed?.processing_mode,
      external_reference: parsed?.external_reference,
      total_amount: parsed?.total_amount,
      currency: parsed?.currency,
      payer: {
        hasEmail: Boolean(parsed?.payer?.email),
        hasIdentification: Boolean(parsed?.payer?.identification),
      },
      transactions: {
        payments: payments.map((payment) => ({
          amount: payment?.amount,
          payment_method: {
            id: payment?.payment_method?.id || '',
            type: payment?.payment_method?.type || '',
            installments: payment?.payment_method?.installments || 0,
            hasToken: Boolean(payment?.payment_method?.token),
          },
        })),
      },
    };
  } catch {
    return { invalidBody: true };
  }
}

export async function mercadopagoRequest(path, options = {}, requestOptions = {}) {
  const accessToken = getMercadoPagoAccessToken(requestOptions.accessToken);
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

  const rawResponse = await response.text().catch(() => '');
  let data = {};

  if (rawResponse) {
    try {
      data = JSON.parse(rawResponse);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const causeDescription = Array.isArray(data.cause)
      ? data.cause.map((cause) => cause?.description).filter(Boolean).join(' | ')
      : '';
    const rawResponseSnippet = rawResponse
      ? String(rawResponse).replace(/\s+/g, ' ').trim().slice(0, 280)
      : '';
    console.error('Mercado Pago request failed', {
      path,
      status: response.status,
      request: sanitizeMercadoPagoBodyForLog(options.body),
      response: {
        message: data.message || '',
        error: data.error || '',
        cause: Array.isArray(data.cause)
          ? data.cause.map((cause) => ({
              code: cause?.code,
              description: cause?.description,
            }))
          : [],
        raw: !data.message && !data.error && !Array.isArray(data.cause) ? rawResponseSnippet : '',
      },
    });

    const error = new Error(
      causeDescription ||
        data.message ||
        data.error ||
        rawResponseSnippet ||
        'Mercado Pago rechazo la operacion.',
    );
    error.status = response.status;
    error.payload = data;
    throw error;
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

export function normalizeExternalReference(value = '') {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized.slice(0, 64) || `ref-${Date.now()}`;
}

function formatMercadoPagoAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

export function buildOrderPaymentPayload(formData = {}, additionalData = {}, fallbackAmount = 0) {
  const amount = Number(formData.transaction_amount || fallbackAmount || 0);

  if (!formData.token) {
    throw new Error('Mercado Pago no genero el token de la tarjeta.');
  }

  if (!formData.payment_method_id) {
    throw new Error('Mercado Pago no informo el medio de pago.');
  }

  const payment = {
    amount: formatMercadoPagoAmount(amount),
    payment_method: {
      id: String(formData.payment_method_id),
      type: inferPaymentType(additionalData.paymentTypeId || formData.payment_method_id),
      token: String(formData.token),
      installments: Math.max(1, Number(formData.installments) || 1),
    },
  };

  return payment;
}

function normalizePayerIdentification(identification = {}) {
  const type = String(identification?.type || '').trim();
  const number = String(identification?.number || '').trim();

  if (!type || !number) {
    return undefined;
  }

  return { type, number };
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
  accessToken = '',
}) {
  const normalizedReference = normalizeExternalReference(externalReference);
  const normalizedIdentification = normalizePayerIdentification(payer.identification);
  const payload = {
    type: 'online',
    processing_mode: 'automatic',
    external_reference: normalizedReference,
    total_amount: formatMercadoPagoAmount(totalAmount),
    payer: {
      email: payer.email,
      ...(normalizedIdentification ? { identification: normalizedIdentification } : {}),
    },
    transactions: {
      payments: [buildOrderPaymentPayload(formData, additionalData, totalAmount)],
    },
  };

  if (currency && String(currency).trim()) {
    payload.currency = String(currency).trim();
  }

  // Keep description optional; some collectors reject richer payloads more often than the minimal official example.
  if (description && String(description).trim()) {
    payload.description = String(description).trim();
  }

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
      idempotencyKey: `${normalizedReference}-${String(formData.token || '').slice(-16)}`,
      accessToken,
    },
  );
}

export async function createMercadoPagoOrderRefund({
  orderId,
  amount,
  accessToken = '',
  idempotencyKey = '',
}) {
  const payload = {};
  if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
    payload.amount = Number(amount.toFixed(2));
  }

  return mercadopagoRequest(
    `/v1/orders/${orderId}/refund`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    {
      idempotencyKey: idempotencyKey || `refund:${orderId}`,
      accessToken,
    },
  );
}

export async function getMercadoPagoOrder(orderId, accessToken = '') {
  return mercadopagoRequest(`/v1/orders/${orderId}`, {}, { accessToken });
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

export function getMercadoPagoOrderRefundSnapshot(order = {}) {
  const refunds = Array.isArray(order?.transactions?.refunds) ? order.transactions.refunds : [];
  const refund = refunds.length > 0 ? refunds[refunds.length - 1] : null;

  return {
    refundId: refund?.id ? String(refund.id) : '',
    refundStatus: String(refund?.status || order?.status_detail || order?.status || ''),
    refundAmount: Number(refund?.amount ?? refund?.total_amount ?? 0) || 0,
    refundedAt: refund?.processed_at || refund?.date_created || order?.updated_at || null,
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

export function isRefundedMercadoPagoOrder(order = {}) {
  const snapshot = getMercadoPagoOrderSnapshot(order);
  const refundSnapshot = getMercadoPagoOrderRefundSnapshot(order);
  const candidates = [
    snapshot.paymentStatus,
    snapshot.paymentStatusDetail,
    snapshot.orderStatus,
    snapshot.orderStatusDetail,
    refundSnapshot.refundStatus,
  ].map((value) => String(value || '').toLowerCase());

  return candidates.includes('refunded') || candidates.includes('fully_refunded');
}

export function isPartiallyRefundedMercadoPagoOrder(order = {}) {
  const snapshot = getMercadoPagoOrderSnapshot(order);
  const refundSnapshot = getMercadoPagoOrderRefundSnapshot(order);
  const candidates = [
    snapshot.paymentStatus,
    snapshot.paymentStatusDetail,
    snapshot.orderStatus,
    snapshot.orderStatusDetail,
    refundSnapshot.refundStatus,
  ].map((value) => String(value || '').toLowerCase());

  return candidates.includes('partially_refunded');
}

export function isCancelledMercadoPagoOrder(order = {}) {
  const snapshot = getMercadoPagoOrderSnapshot(order);
  const normalizedStatus = snapshot.paymentStatus.toLowerCase();
  const normalizedDetail = snapshot.paymentStatusDetail.toLowerCase();

  return ['cancelled', 'canceled', 'expired'].includes(normalizedStatus) || ['cancelled', 'canceled', 'expired'].includes(normalizedDetail);
}

export function isFailedMercadoPagoOrder(order = {}) {
  if (
    isApprovedMercadoPagoOrder(order) ||
    isPendingMercadoPagoOrder(order) ||
    isCancelledMercadoPagoOrder(order) ||
    isRefundedMercadoPagoOrder(order) ||
    isPartiallyRefundedMercadoPagoOrder(order)
  ) {
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
