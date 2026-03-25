import {
  createOrReuseOwnerCheckout,
  extractMercadoPagoPaymentId,
  getOwnerBillingHistory,
  getOwnerBillingState,
  syncOwnerBillingPayment,
} from '../utils/ownerBilling.js';

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
