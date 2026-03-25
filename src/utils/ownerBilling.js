import Complex from '../models/Complex.js';
import OwnerBilling from '../models/OwnerBilling.js';
import User from '../models/User.js';
import {
  createAutomaticMercadoPagoOrder,
  extractMercadoPagoOrderId,
  getMercadoPagoOrder,
  getMercadoPagoOrderSnapshot,
  isApprovedMercadoPagoOrder,
  isCancelledMercadoPagoOrder,
  isFailedMercadoPagoOrder,
  isMercadoPagoConfigured,
  isPendingMercadoPagoOrder,
} from './mercadoPago.js';

const DEFAULT_AMOUNT_ARS = 30000;
const DEFAULT_CURRENCY = 'ARS';
const DEFAULT_GRACE_DAYS = 10;
const DEFAULT_BILLING_MONTHS = 1;

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

function getBillingAmount() {
  const parsed = Number(process.env.OWNER_MONTHLY_FEE_ARS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AMOUNT_ARS;
}

function getBillingCurrency() {
  return process.env.OWNER_MONTHLY_FEE_CURRENCY || DEFAULT_CURRENCY;
}

function getGraceDays() {
  const parsed = Number(process.env.OWNER_PAYMENT_GRACE_DAYS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GRACE_DAYS;
}

function getBillingMonths() {
  const parsed = Number(process.env.OWNER_BILLING_CYCLE_MONTHS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BILLING_MONTHS;
}

function getConfiguredTestPayerEmail() {
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    return '';
  }

  return String(process.env.MERCADOPAGO_TEST_PAYER_EMAIL || '').trim();
}

function resolveOwnerBillingPayer(owner, requestedEmail = '') {
  const configuredTestEmail = getConfiguredTestPayerEmail();
  if (configuredTestEmail) {
    return {
      email: configuredTestEmail,
      usesConfiguredTestEmail: true,
    };
  }

  const normalizedRequestedEmail = String(requestedEmail || '').trim();
  if (normalizedRequestedEmail) {
    return {
      email: normalizedRequestedEmail,
      usesConfiguredTestEmail: false,
    };
  }

  return {
    email: owner.email,
    usesConfiguredTestEmail: false,
  };
}

function buildExternalReference(ownerBillingId) {
  return `owner-billing:${ownerBillingId}`;
}

function buildInvoiceDescription(owner) {
  return `Acceso mensual Clubes Tucumán - ${owner.displayName || owner.email}`;
}

function getInvoiceBlockAt(invoice) {
  return invoice?.dueDate ? new Date(invoice.dueDate) : null;
}

function getPaidInvoiceGraceEnd(invoice) {
  return invoice?.accessEndsAt ? addDays(invoice.accessEndsAt, getGraceDays()) : null;
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
    graceEndsAt: invoice.status === 'PAID' ? getPaidInvoiceGraceEnd(invoice) : getInvoiceBlockAt(invoice),
    paymentId: invoice.mercadoPagoPaymentId || '',
    paymentStatus: invoice.mercadoPagoStatus || '',
    paymentStatusDetail: invoice.mercadoPagoStatusDetail || '',
    mercadoPagoOrderId: invoice.mercadoPagoOrderId || '',
    mercadoPagoOrderStatus: invoice.mercadoPagoOrderStatus || '',
    mercadoPagoOrderStatusDetail: invoice.mercadoPagoOrderStatusDetail || '',
    paymentMethodId: invoice.mercadoPagoPaymentMethodId || '',
    paymentMethodType: invoice.mercadoPagoPaymentMethodType || '',
    createdAt: invoice.createdAt,
  };
}

async function getLatestPendingInvoice(ownerId) {
  return OwnerBilling.findOne({ ownerId, status: 'PENDING' }).sort({ createdAt: -1 });
}

async function getLatestPaidInvoice(ownerId) {
  return OwnerBilling.findOne({ ownerId, status: 'PAID' }).sort({ accessEndsAt: -1 });
}

async function getActivePaidInvoice(ownerId, now) {
  return OwnerBilling.findOne({
    ownerId,
    status: 'PAID',
    accessEndsAt: { $gt: now },
  }).sort({ accessEndsAt: -1 });
}

/**
 * Si una factura fue puesta en PAID manualmente en la DB (sin pasar por el
 * flujo de MercadoPago), accessEndsAt queda null y el sistema la ignora
 * creando una nueva pendiente. Esta función la repara calculando las fechas
 * desde paidAt/updatedAt/createdAt.
 */
async function repairMissingAccessDates(invoice) {
  if (!invoice || invoice.status !== 'PAID' || invoice.accessEndsAt) return invoice;

  const base = invoice.paidAt || invoice.updatedAt || invoice.createdAt;
  const accessStart = invoice.accessStartsAt || new Date(base);
  const accessEnd = addMonths(accessStart, getBillingMonths());

  invoice.paidAt = invoice.paidAt || new Date(base);
  invoice.accessStartsAt = accessStart;
  invoice.accessEndsAt = accessEnd;
  await invoice.save();
  return invoice;
}

async function createPendingInvoice(owner, dueDate) {
  const invoice = new OwnerBilling({
    ownerId: owner._id,
    amount: getBillingAmount(),
    currency: getBillingCurrency(),
    dueDate,
    externalReference: `owner-billing:draft:${owner._id}:${Date.now()}`,
  });

  invoice.externalReference = buildExternalReference(invoice._id.toString());
  await invoice.save();
  return invoice;
}

function getOwnerPaymentSession(invoice, owner, requestedPayerEmail = '') {
  const payer = resolveOwnerBillingPayer(owner, requestedPayerEmail);

  return {
    provider: 'mercadopago',
    checkoutMode: 'orders',
    amount: invoice.amount,
    currency: invoice.currency,
    invoiceId: invoice._id,
    description: buildInvoiceDescription(owner),
    payer: {
      email: payer.email,
      usesConfiguredTestEmail: payer.usesConfiguredTestEmail,
    },
  };
}

async function ensureInvoiceForCurrentCycle(owner, latestPaidInvoice, createIfMissing) {
  if (!createIfMissing) {
    return getLatestPendingInvoice(owner._id);
  }

  const existingPending = await getLatestPendingInvoice(owner._id);
  if (existingPending) {
    return existingPending;
  }

  const now = new Date();
  const dueDate = latestPaidInvoice?.accessEndsAt
    ? addDays(new Date(latestPaidInvoice.accessEndsAt), getGraceDays())
    : addDays(now, getGraceDays());

  return createPendingInvoice(owner, dueDate);
}

function applySnapshotToInvoice(invoice, snapshot) {
  invoice.mercadoPagoOrderId = snapshot.orderId;
  invoice.mercadoPagoOrderStatus = snapshot.orderStatus;
  invoice.mercadoPagoOrderStatusDetail = snapshot.orderStatusDetail;
  invoice.mercadoPagoPaymentId = snapshot.paymentId;
  invoice.mercadoPagoStatus = snapshot.paymentStatus;
  invoice.mercadoPagoStatusDetail = snapshot.paymentStatusDetail;
  invoice.mercadoPagoPaymentMethodId = snapshot.paymentMethodId;
  invoice.mercadoPagoPaymentMethodType = snapshot.paymentMethodType;
}

async function markInvoiceAsPaid(invoice, approvedAt) {
  const lastPaidInvoice = await OwnerBilling.findOne({
    ownerId: invoice.ownerId,
    status: 'PAID',
    _id: { $ne: invoice._id },
  }).sort({ accessEndsAt: -1 });

  const accessStart =
    lastPaidInvoice?.accessEndsAt && lastPaidInvoice.accessEndsAt > approvedAt
      ? new Date(lastPaidInvoice.accessEndsAt)
      : approvedAt;

  invoice.status = 'PAID';
  invoice.paidAt = approvedAt;
  invoice.accessStartsAt = accessStart;
  invoice.accessEndsAt = addMonths(accessStart, getBillingMonths());
}

async function syncInvoiceFromMercadoPagoOrder(invoice, order) {
  const snapshot = getMercadoPagoOrderSnapshot(order);
  applySnapshotToInvoice(invoice, snapshot);

  if (isApprovedMercadoPagoOrder(order)) {
    const approvedAt = snapshot.approvedAt ? new Date(snapshot.approvedAt) : new Date();
    await markInvoiceAsPaid(invoice, approvedAt);
  } else if (isCancelledMercadoPagoOrder(order)) {
    if (invoice.status !== 'PAID') {
      invoice.status = 'CANCELLED';
    }
  } else if (isPendingMercadoPagoOrder(order)) {
    if (invoice.status !== 'PAID') {
      invoice.status = 'PENDING';
    }
  } else if (isFailedMercadoPagoOrder(order) && invoice.status !== 'PAID') {
    invoice.status = 'FAILED';
  }

  await invoice.save();
  return invoice;
}

export async function getOwnerBillingState(owner, options = {}) {
  const { createIfMissing = true } = options;

  if (!owner || owner.role !== 'owner' || owner.ownerStatus !== 'APPROVED') {
    return {
      required: false,
      provider: 'mercadopago',
      checkoutMode: 'orders',
      providerConfigured: isMercadoPagoConfigured(),
      hasAccess: true,
      status: 'NOT_REQUIRED',
      amount: getBillingAmount(),
      currency: getBillingCurrency(),
      graceDays: getGraceDays(),
      currentInvoice: null,
      lastPaidInvoice: null,
      accessEndsAt: null,
      blockAt: null,
    };
  }

  const now = new Date();

  // Reparar facturas PAID sin accessEndsAt antes de evaluar el estado activo.
  // Esto ocurre cuando un admin las marca manualmente en la DB.
  const rawLatestPaid = await getLatestPaidInvoice(owner._id);
  if (rawLatestPaid && !rawLatestPaid.accessEndsAt) {
    await repairMissingAccessDates(rawLatestPaid);
  }

  const activePaidInvoice = await getActivePaidInvoice(owner._id, now);
  const latestPaidInvoice = activePaidInvoice || rawLatestPaid;

  if (activePaidInvoice) {
    return {
      required: true,
      provider: 'mercadopago',
      checkoutMode: 'orders',
      providerConfigured: isMercadoPagoConfigured(),
      hasAccess: true,
      status: 'ACTIVE',
      amount: activePaidInvoice.amount,
      currency: activePaidInvoice.currency,
      graceDays: getGraceDays(),
      currentInvoice: serializeInvoice(activePaidInvoice),
      lastPaidInvoice: serializeInvoice(activePaidInvoice),
      accessEndsAt: activePaidInvoice.accessEndsAt,
      blockAt: getPaidInvoiceGraceEnd(activePaidInvoice),
    };
  }

  const pendingInvoice = await ensureInvoiceForCurrentCycle(owner, latestPaidInvoice, createIfMissing);
  const blockAt = getInvoiceBlockAt(pendingInvoice);
  const hasGraceAccess = Boolean(blockAt && blockAt > now);

  return {
    required: true,
    provider: 'mercadopago',
    checkoutMode: 'orders',
    providerConfigured: isMercadoPagoConfigured(),
    hasAccess: hasGraceAccess,
    status: hasGraceAccess ? 'GRACE' : 'BLOCKED',
    amount: pendingInvoice?.amount ?? getBillingAmount(),
    currency: pendingInvoice?.currency ?? getBillingCurrency(),
    graceDays: getGraceDays(),
    currentInvoice: serializeInvoice(pendingInvoice),
    lastPaidInvoice: serializeInvoice(latestPaidInvoice),
    accessEndsAt: latestPaidInvoice?.accessEndsAt || null,
    blockAt,
  };
}

export async function getOwnerBillingHistory(ownerId) {
  const invoices = await OwnerBilling.find({ ownerId }).sort({ createdAt: -1 });
  return invoices.map(serializeInvoice);
}

export async function createOrReuseOwnerCheckout(owner) {
  const latestPaidInvoice = await getLatestPaidInvoice(owner._id);
  let pendingInvoice = await getLatestPendingInvoice(owner._id);

  if (!pendingInvoice) {
    const dueDate = latestPaidInvoice?.accessEndsAt
      ? addDays(new Date(latestPaidInvoice.accessEndsAt), getGraceDays())
      : addDays(new Date(), getGraceDays());

    pendingInvoice = await createPendingInvoice(owner, dueDate);
  }

  return {
    invoice: pendingInvoice,
    paymentSession: getOwnerPaymentSession(pendingInvoice, owner),
  };
}

export async function processOwnerBillingOrder(owner, invoiceId, formData, additionalData = {}) {
  const invoice = await OwnerBilling.findOne({
    _id: invoiceId,
    ownerId: owner._id,
  });

  if (!invoice) {
    const error = new Error('Factura de mensualidad no encontrada.');
    error.status = 404;
    throw error;
  }

  if (invoice.status === 'PAID') {
    return {
      invoice: serializeInvoice(invoice),
      ownerBilling: await getOwnerBillingState(owner),
      paymentSession: getOwnerPaymentSession(invoice, owner, formData?.payer?.email),
    };
  }

  const payer = resolveOwnerBillingPayer(owner, formData?.payer?.email);

  const order = await createAutomaticMercadoPagoOrder({
    externalReference: invoice.externalReference,
    totalAmount: invoice.amount,
    currency: invoice.currency,
    description: buildInvoiceDescription(owner),
    payer: {
      email: payer.email,
      identification: formData?.payer?.identification || undefined,
    },
    formData,
    additionalData,
    notificationPath: '/api/owner-billing/webhook/mercadopago',
  });

  const syncedInvoice = await syncInvoiceFromMercadoPagoOrder(invoice, order);

  return {
    invoice: serializeInvoice(syncedInvoice),
    ownerBilling: await getOwnerBillingState(owner),
    paymentSession: getOwnerPaymentSession(syncedInvoice, owner, payer.email),
  };
}

export async function syncOwnerBillingPayment(orderId) {
  const order = await getMercadoPagoOrder(orderId);

  let invoice = null;

  if (order.external_reference) {
    invoice = await OwnerBilling.findOne({ externalReference: order.external_reference });
  }

  if (!invoice && order.id) {
    invoice = await OwnerBilling.findOne({ mercadoPagoOrderId: String(order.id) });
  }

  if (!invoice) {
    return { ok: false, reason: 'invoice_not_found' };
  }

  const syncedInvoice = await syncInvoiceFromMercadoPagoOrder(invoice, order);

  return {
    ok: true,
    invoice: serializeInvoice(syncedInvoice),
    paymentStatus: syncedInvoice.mercadoPagoStatus,
  };
}

async function resolveComplexOwner(complex) {
  if (!complex) return null;

  if (complex.ownerId && typeof complex.ownerId === 'object' && complex.ownerId.email) {
    return complex.ownerId;
  }

  return User.findById(complex.ownerId);
}

export async function getComplexOperationalState(complexOrId, options = {}) {
  const { createBillingIfMissing = true } = options;

  const complex =
    typeof complexOrId === 'string'
      ? await Complex.findById(complexOrId).populate('ownerId')
      : complexOrId;

  if (!complex) {
    return { isOperational: false, reason: 'COMPLEX_NOT_FOUND', complex: null, ownerBilling: null };
  }

  if (!complex.isActive) {
    return { isOperational: false, reason: 'COMPLEX_INACTIVE', complex, ownerBilling: null };
  }

  const owner = await resolveComplexOwner(complex);
  if (!owner || owner.role !== 'owner' || owner.ownerStatus !== 'APPROVED') {
    return { isOperational: false, reason: 'OWNER_NOT_APPROVED', complex, ownerBilling: null };
  }

  const ownerBilling = await getOwnerBillingState(owner, {
    createIfMissing: createBillingIfMissing,
  });

  return {
    isOperational: ownerBilling.hasAccess,
    reason: ownerBilling.hasAccess ? null : 'OWNER_PAYMENT_REQUIRED',
    complex,
    owner,
    ownerBilling,
  };
}

export async function assertComplexClientAccess(complexId, options = {}) {
  const state = await getComplexOperationalState(complexId, options);

  if (!state.complex) {
    const error = new Error('Complejo no encontrado');
    error.status = 404;
    throw error;
  }

  if (!state.isOperational) {
    const error = new Error('Este complejo no esta disponible temporalmente.');
    error.status = 403;
    error.code = state.reason;
    error.ownerBilling = state.ownerBilling;
    throw error;
  }

  return state;
}

export async function filterClientVisibleComplexes(complexes, options = {}) {
  const { createBillingIfMissing = true } = options;
  const evaluated = await Promise.all(
    complexes.map(async (complex) => ({
      complex,
      state: await getComplexOperationalState(complex, { createBillingIfMissing }),
    })),
  );

  return evaluated.filter((item) => item.state.isOperational).map((item) => item.complex);
}

export function extractMercadoPagoPaymentId(payload = {}) {
  return extractMercadoPagoOrderId(payload);
}
