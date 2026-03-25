import {
  createOrReuseOwnerCheckout,
  extractMercadoPagoPaymentId,
  getOwnerBillingHistory,
  getOwnerBillingState,
  syncOwnerBillingPayment,
} from '../utils/ownerBilling.js';
import Complex from '../models/Complex.js';
import OwnerBilling from '../models/OwnerBilling.js';

function serializeAdminInvoice(invoice, complexes = []) {
  return {
    id: invoice._id,
    owner: invoice.ownerId
      ? {
          _id: invoice.ownerId._id,
          displayName: invoice.ownerId.displayName,
          email: invoice.ownerId.email,
          photoURL: invoice.ownerId.photoURL || '',
          ownerStatus: invoice.ownerId.ownerStatus || null,
        }
      : null,
    complexes,
    status: invoice.status,
    amount: invoice.amount,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    accessStartsAt: invoice.accessStartsAt,
    accessEndsAt: invoice.accessEndsAt,
    checkoutUrl: invoice.checkoutUrl || invoice.checkoutSandboxUrl || '',
    paymentId: invoice.mercadoPagoPaymentId || '',
    paymentStatus: invoice.mercadoPagoStatus || '',
    externalReference: invoice.externalReference,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export const getCurrentOwnerBilling = async (req, res) => {
  try {
    const ownerBilling = await getOwnerBillingState(req.dbUser);
    res.json(ownerBilling);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo la facturacion', error: error.message });
  }
};

export const createOwnerBillingCheckout = async (req, res) => {
  try {
    const invoice = await createOrReuseOwnerCheckout(req.dbUser);
    const ownerBilling = await getOwnerBillingState(req.dbUser);

    res.json({
      message: 'Checkout generado correctamente.',
      checkoutUrl: invoice.checkoutUrl || invoice.checkoutSandboxUrl || '',
      ownerBilling,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generando el checkout', error: error.message });
  }
};

export const getOwnerBillingInvoices = async (req, res) => {
  try {
    const invoices = await getOwnerBillingHistory(req.dbUser._id);
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo historial', error: error.message });
  }
};

export const getAdminOwnerBillingInvoices = async (req, res) => {
  try {
    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.ownerId) {
      filter.ownerId = req.query.ownerId;
    }

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) {
        filter.createdAt.$gte = new Date(req.query.from);
      }
      if (req.query.to) {
        const toDate = new Date(req.query.to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    const invoices = await OwnerBilling.find(filter)
      .populate('ownerId', 'displayName email photoURL ownerStatus')
      .sort({ createdAt: -1 });

    const ownerIds = [
      ...new Set(
        invoices
          .map((invoice) => invoice.ownerId?._id?.toString())
          .filter(Boolean),
      ),
    ];

    const complexes = await Complex.find({ ownerId: { $in: ownerIds } })
      .select('name ownerId isActive')
      .lean();

    const complexesByOwner = complexes.reduce((map, complex) => {
      const key = complex.ownerId.toString();
      const current = map.get(key) || [];
      current.push({
        _id: complex._id,
        name: complex.name,
        isActive: complex.isActive,
      });
      map.set(key, current);
      return map;
    }, new Map());

    const search = String(req.query.q || '').trim().toLowerCase();

    let payload = invoices.map((invoice) =>
      serializeAdminInvoice(
        invoice,
        complexesByOwner.get(invoice.ownerId?._id?.toString() || '') || [],
      ),
    );

    if (search) {
      payload = payload.filter((invoice) =>
        [
          invoice.owner?.displayName,
          invoice.owner?.email,
          invoice.status,
          invoice.paymentStatus,
          invoice.externalReference,
          ...invoice.complexes.map((complex) => complex.name),
        ].some((value) => String(value || '').toLowerCase().includes(search)),
      );
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo la facturacion global', error: error.message });
  }
};

export const handleMercadoPagoWebhook = async (req, res) => {
  try {
    const paymentId = extractMercadoPagoPaymentId({
      ...req.body,
      query: req.query,
    });

    if (!paymentId) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const result = await syncOwnerBillingPayment(paymentId);
    res.status(200).json({ received: true, result });
  } catch (error) {
    res.status(200).json({
      received: true,
      error: error.message,
    });
  }
};
