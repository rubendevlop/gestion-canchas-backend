import OwnerBilling from '../models/OwnerBilling.js';

const MP_API_BASE = 'https://api.mercadopago.com';
const DEFAULT_AMOUNT_ARS = 30000;
const DEFAULT_CURRENCY = 'ARS';

function addMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
}

function getBackendUrl() {
  return process.env.BACKEND_PUBLIC_URL || process.env.API_URL || 'http://localhost:5000';
}

function getBillingAmount() {
  const parsed = Number(process.env.OWNER_MONTHLY_FEE_ARS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AMOUNT_ARS;
}

function getBillingCurrency() {
  return process.env.OWNER_MONTHLY_FEE_CURRENCY || DEFAULT_CURRENCY;
}

function isMercadoPagoConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

function buildExternalReference(ownerBillingId) {
  return `owner-billing:${ownerBillingId}`;
}

async function mercadopagoRequest(path, options = {}) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('Mercado Pago no esta configurado.');
  }

  const response = await fetch(`${MP_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Mercado Pago rechazo la operacion.');
  }

  return data;
}

async function createPendingInvoice(owner) {
  const invoice = new OwnerBilling({
    ownerId: owner._id,
    amount: getBillingAmount(),
    currency: getBillingCurrency(),
    dueDate: addDays(new Date(), 7),
    externalReference: `owner-billing:draft:${owner._id}:${Date.now()}`,
  });

  invoice.externalReference = buildExternalReference(invoice._id.toString());
  await invoice.save();
  return invoice;
}

async function ensureCheckoutPreference(invoice, owner) {
  if (invoice.checkoutUrl || !isMercadoPagoConfigured()) {
    return invoice;
  }

  const frontendUrl = getFrontendUrl().replace(/\/$/, '');
  const backendUrl = getBackendUrl().replace(/\/$/, '');
  const title = `Acceso mensual Gestion Pro - ${owner.displayName || owner.email}`;

  const preference = await mercadopagoRequest('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [
        {
          title,
          description: 'Pago mensual de acceso al panel owner',
          quantity: 1,
          currency_id: invoice.currency,
          unit_price: invoice.amount,
        },
      ],
      payer: {
        email: owner.email,
        name: owner.displayName,
      },
      back_urls: {
        success: `${frontendUrl}/dashboard?mp_status=success`,
        pending: `${frontendUrl}/dashboard?mp_status=pending`,
        failure: `${frontendUrl}/dashboard?mp_status=failure`,
      },
      auto_return: 'approved',
      external_reference: invoice.externalReference,
      notification_url: `${backendUrl}/api/owner-billing/webhook/mercadopago`,
      metadata: {
        ownerBillingId: invoice._id.toString(),
        ownerId: owner._id.toString(),
        scope: 'owner-monthly-access',
      },
    }),
  });

  invoice.checkoutUrl = preference.init_point || '';
  invoice.checkoutSandboxUrl = preference.sandbox_init_point || '';
  invoice.mercadoPagoPreferenceId = preference.id || '';
  invoice.mercadoPagoStatus = 'preference_created';
  await invoice.save();

  return invoice;
}

function serializeInvoice(invoice) {
  if (!invoice) return null;

  return {
    id: invoice._id,
    status: invoice.status,
    amount: invoice.amount,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    accessStartsAt: invoice.accessStartsAt,
    accessEndsAt: invoice.accessEndsAt,
    checkoutUrl: invoice.checkoutUrl || invoice.checkoutSandboxUrl || '',
    preferenceId: invoice.mercadoPagoPreferenceId || '',
    paymentId: invoice.mercadoPagoPaymentId || '',
    paymentStatus: invoice.mercadoPagoStatus || '',
    createdAt: invoice.createdAt,
  };
}

export async function getOwnerBillingState(owner, options = {}) {
  const { createIfMissing = true } = options;

  if (!owner || owner.role !== 'owner' || owner.ownerStatus !== 'APPROVED') {
    return {
      required: false,
      provider: 'mercadopago',
      providerConfigured: isMercadoPagoConfigured(),
      hasAccess: true,
      status: 'NOT_REQUIRED',
      amount: getBillingAmount(),
      currency: getBillingCurrency(),
      currentInvoice: null,
      history: [],
      accessEndsAt: null,
    };
  }

  const now = new Date();
  const activeInvoice = await OwnerBilling.findOne({
    ownerId: owner._id,
    status: 'PAID',
    accessEndsAt: { $gt: now },
  }).sort({ accessEndsAt: -1 });

  if (activeInvoice) {
    return {
      required: true,
      provider: 'mercadopago',
      providerConfigured: isMercadoPagoConfigured(),
      hasAccess: true,
      status: 'PAID',
      amount: activeInvoice.amount,
      currency: activeInvoice.currency,
      accessEndsAt: activeInvoice.accessEndsAt,
      currentInvoice: serializeInvoice(activeInvoice),
    };
  }

  let pendingInvoice = await OwnerBilling.findOne({
    ownerId: owner._id,
    status: 'PENDING',
  }).sort({ createdAt: -1 });

  if (!pendingInvoice && createIfMissing) {
    pendingInvoice = await createPendingInvoice(owner);
  }

  if (pendingInvoice) {
    pendingInvoice = await ensureCheckoutPreference(pendingInvoice, owner);
  }

  return {
    required: true,
    provider: 'mercadopago',
    providerConfigured: isMercadoPagoConfigured(),
    hasAccess: false,
    status: 'PENDING_PAYMENT',
    amount: pendingInvoice?.amount ?? getBillingAmount(),
    currency: pendingInvoice?.currency ?? getBillingCurrency(),
    accessEndsAt: null,
    currentInvoice: serializeInvoice(pendingInvoice),
  };
}

export async function getOwnerBillingHistory(ownerId) {
  const invoices = await OwnerBilling.find({ ownerId }).sort({ createdAt: -1 });
  return invoices.map(serializeInvoice);
}

export async function createOrReuseOwnerCheckout(owner) {
  let pendingInvoice = await OwnerBilling.findOne({
    ownerId: owner._id,
    status: 'PENDING',
  }).sort({ createdAt: -1 });

  if (!pendingInvoice) {
    pendingInvoice = await createPendingInvoice(owner);
  }

  pendingInvoice = await ensureCheckoutPreference(pendingInvoice, owner);
  return pendingInvoice;
}

export async function syncOwnerBillingPayment(paymentId) {
  const payment = await mercadopagoRequest(`/v1/payments/${paymentId}`);

  let invoice = null;

  if (payment.external_reference) {
    invoice = await OwnerBilling.findOne({ externalReference: payment.external_reference });
  }

  if (!invoice && payment.metadata?.ownerBillingId) {
    invoice = await OwnerBilling.findById(payment.metadata.ownerBillingId);
  }

  if (!invoice) {
    return { ok: false, reason: 'invoice_not_found' };
  }

  invoice.mercadoPagoPaymentId = String(payment.id || paymentId);
  invoice.mercadoPagoStatus = payment.status || '';
  invoice.mercadoPagoStatusDetail = payment.status_detail || '';

  if (payment.status === 'approved') {
    const approvedAt = payment.date_approved ? new Date(payment.date_approved) : new Date();
    const lastPaidInvoice = await OwnerBilling.findOne({
      ownerId: invoice.ownerId,
      status: 'PAID',
      _id: { $ne: invoice._id },
    }).sort({ accessEndsAt: -1 });

    const accessStart =
      lastPaidInvoice?.accessEndsAt && lastPaidInvoice.accessEndsAt > approvedAt
        ? lastPaidInvoice.accessEndsAt
        : approvedAt;

    invoice.status = 'PAID';
    invoice.paidAt = approvedAt;
    invoice.accessStartsAt = accessStart;
    invoice.accessEndsAt = addMonths(accessStart, 1);
  } else if (payment.status === 'cancelled') {
    invoice.status = 'CANCELLED';
  } else if (!['pending', 'in_process'].includes(payment.status)) {
    invoice.status = 'FAILED';
  }

  await invoice.save();

  return {
    ok: true,
    invoice: serializeInvoice(invoice),
    paymentStatus: payment.status,
  };
}

export function extractMercadoPagoPaymentId(payload = {}) {
  return (
    payload?.data?.id ||
    payload?.id ||
    payload?.resource?.split('/').pop() ||
    payload?.query?.id ||
    payload?.query?.['data.id'] ||
    null
  );
}
