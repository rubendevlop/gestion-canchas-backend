import {
  createOrReuseOwnerCheckout,
  extractMercadoPagoPaymentId,
  getOwnerBillingHistory,
  getOwnerBillingState,
  processOwnerBillingOrder,
  syncOwnerBillingPayment,
} from '../utils/ownerBilling.js';
import Complex from '../models/Complex.js';
import OwnerBilling from '../models/OwnerBilling.js';
import { validateMercadoPagoWebhookSignature } from '../utils/mercadoPago.js';

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
    mercadoPagoOrderId: invoice.mercadoPagoOrderId || '',
    mercadoPagoOrderStatus: invoice.mercadoPagoOrderStatus || '',
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
    const { invoice, paymentSession } = await createOrReuseOwnerCheckout(req.dbUser);
    const ownerBilling = await getOwnerBillingState(req.dbUser);

    res.json({
      message: 'Sesion de pago preparada correctamente.',
      invoice: {
        id: invoice._id,
        amount: invoice.amount,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        status: invoice.status,
      },
      paymentSession,
      ownerBilling,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error preparando el pago', error: error.message });
  }
};

export const processOwnerBillingCheckout = async (req, res) => {
  try {
    const { invoiceId, formData, additionalData } = req.body;

    if (!invoiceId || !formData?.token) {
      return res.status(400).json({ message: 'invoiceId y formData son requeridos.' });
    }

    const result = await processOwnerBillingOrder(req.dbUser, invoiceId, formData, additionalData);

    res.json({
      message: 'Pago procesado correctamente.',
      ...result,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error procesando el pago', error: error.message });
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

export const approveAdminOwnerBillingInvoice = async (req, res) => {
  try {
    const invoice = await OwnerBilling.findById(req.params.id).populate('ownerId', 'displayName email ownerStatus');

    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada.' });
    }

    if (invoice.status === 'PAID') {
      return res.status(400).json({ message: 'La factura ya esta pagada.' });
    }

    const now = new Date();
    const { note, accessEndsAt: customAccessEndsAt } = req.body || {};

    // Calcular accessEndsAt en base a la ultima factura PAID del mismo owner
    const lastPaid = await OwnerBilling.findOne({
      ownerId: invoice.ownerId,
      status: 'PAID',
      _id: { $ne: invoice._id },
    }).sort({ accessEndsAt: -1 });

    const billingMonths = Number(process.env.OWNER_BILLING_CYCLE_MONTHS) || 1;

    const accessStart =
      lastPaid?.accessEndsAt && new Date(lastPaid.accessEndsAt) > now
        ? new Date(lastPaid.accessEndsAt)
        : now;

    let accessEnd;
    if (customAccessEndsAt) {
      accessEnd = new Date(customAccessEndsAt);
      if (isNaN(accessEnd.getTime())) {
        return res.status(400).json({ message: 'La fecha de vencimiento de acceso es invalida.' });
      }
    } else {
      accessEnd = new Date(accessStart);
      accessEnd.setMonth(accessEnd.getMonth() + billingMonths);
    }

    invoice.status = 'PAID';
    invoice.paidAt = now;
    invoice.accessStartsAt = accessStart;
    invoice.accessEndsAt = accessEnd;
    if (note) {
      invoice.adminNote = String(note).trim().slice(0, 500);
    }
    await invoice.save();

    res.json({
      message: `Factura aprobada manualmente. Acceso habilitado hasta ${accessEnd.toLocaleDateString('es-AR')}.`,
      invoice: {
        id: invoice._id,
        status: invoice.status,
        paidAt: invoice.paidAt,
        accessStartsAt: invoice.accessStartsAt,
        accessEndsAt: invoice.accessEndsAt,
        adminNote: invoice.adminNote || '',
        owner: invoice.ownerId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error aprobando la factura', error: error.message });
  }
};

export const handleMercadoPagoWebhook = async (req, res) => {
  try {
    if (!validateMercadoPagoWebhookSignature(req)) {
      return res.status(401).json({ received: false, error: 'Firma de webhook invalida.' });
    }

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
