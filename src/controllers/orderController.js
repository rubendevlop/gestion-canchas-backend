import Complex from '../models/Complex.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { validateMercadoPagoWebhookSignature } from '../utils/mercadoPago.js';
import { getOwnerPaymentProvider } from '../utils/paymentAccounts.js';
import {
  assertComplexClientAccess,
} from '../utils/ownerBilling.js';
import {
  createAutomaticMercadoPagoOrder,
  extractMercadoPagoOrderId,
  getMercadoPagoOrder,
  getMercadoPagoOrderSnapshot,
  isApprovedMercadoPagoOrder,
  isCancelledMercadoPagoOrder,
  isFailedMercadoPagoOrder,
  isPendingMercadoPagoOrder,
} from '../utils/mercadoPago.js';

function buildExternalReference(orderId) {
  return `store-order:${orderId}`;
}

function buildOrderDescription(order, complex) {
  return `Pedido tienda ${complex?.name || 'Clubes Tucumán'} #${String(order._id).slice(-6).toUpperCase()}`;
}

function serializeOrderPaymentSession(order, user, complex, paymentProvider = {}) {
  return {
    provider: 'mercadopago',
    checkoutMode: 'orders',
    providerConfigured: paymentProvider.configured === true,
    publicKey: paymentProvider.publicKey || '',
    orderId: order._id,
    amount: order.totalAmount,
    currency: 'ARS',
    description: buildOrderDescription(order, complex),
    payer: {
      email: user.email,
    },
    providerAccount: paymentProvider.accountSummary
      ? {
          collectorNickname: paymentProvider.accountSummary.collectorNickname,
          collectorEmail: paymentProvider.accountSummary.collectorEmail,
          mode: paymentProvider.accountSummary.mode,
        }
      : null,
  };
}

function applySnapshotToOrder(order, snapshot) {
  order.mercadoPagoOrderId = snapshot.orderId;
  order.mercadoPagoOrderStatus = snapshot.orderStatus;
  order.mercadoPagoOrderStatusDetail = snapshot.orderStatusDetail;
  order.mercadoPagoPaymentId = snapshot.paymentId;
  order.mercadoPagoStatus = snapshot.paymentStatus;
  order.mercadoPagoStatusDetail = snapshot.paymentStatusDetail;
  order.mercadoPagoPaymentMethodId = snapshot.paymentMethodId;
  order.mercadoPagoPaymentMethodType = snapshot.paymentMethodType;
}

async function syncLocalOrderFromMercadoPagoOrder(localOrder, mercadoPagoOrder) {
  const snapshot = getMercadoPagoOrderSnapshot(mercadoPagoOrder);
  applySnapshotToOrder(localOrder, snapshot);

  if (isApprovedMercadoPagoOrder(mercadoPagoOrder)) {
    localOrder.status = 'completed';
    localOrder.paidAt = snapshot.approvedAt ? new Date(snapshot.approvedAt) : new Date();
  } else if (isCancelledMercadoPagoOrder(mercadoPagoOrder)) {
    localOrder.status = 'cancelled';
  } else if (isPendingMercadoPagoOrder(mercadoPagoOrder)) {
    localOrder.status = 'pending';
  } else if (isFailedMercadoPagoOrder(mercadoPagoOrder)) {
    localOrder.status = 'failed';
  }

  await localOrder.save();
  return localOrder;
}

async function loadOrderForUser(orderId, dbUser) {
  const order = await Order.findById(orderId).populate('complexId', 'name ownerId');

  if (!order) {
    const error = new Error('Pedido no encontrado.');
    error.status = 404;
    throw error;
  }

  if (
    dbUser.role === 'client' &&
    order.userId.toString() !== dbUser._id.toString()
  ) {
    const error = new Error('No autorizado para pagar este pedido.');
    error.status = 403;
    throw error;
  }

  if (dbUser.role === 'owner') {
    const ownedComplex = await Complex.findOne({ _id: order.complexId?._id, ownerId: dbUser._id }).select('_id');
    if (!ownedComplex) {
      const error = new Error('No autorizado para ver este pedido.');
      error.status = 403;
      throw error;
    }
  }

  return order;
}

export const createOrder = async (req, res) => {
  try {
    const { complexId, items = [] } = req.body;

    if (!complexId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'complexId e items son requeridos.' });
    }

    await assertComplexClientAccess(complexId, { createBillingIfMissing: true });
    const complex = await Complex.findById(complexId).select('name ownerId');
    const paymentProvider = complex?.ownerId
      ? await getOwnerPaymentProvider(complex.ownerId)
      : { configured: false, publicKey: '', accountSummary: null };

    if (!paymentProvider.configured || paymentProvider.accountSummary?.ordersEnabled === false) {
      return res.status(409).json({
        error: 'El complejo todavia no tiene cobros online configurados para la tienda.',
      });
    }

    const productIds = items.map((item) => item.productId).filter(Boolean);
    const products = await Product.find({
      _id: { $in: productIds },
      complexId,
    });

    const productsById = new Map(products.map((product) => [product._id.toString(), product]));
    const normalizedItems = items.map((item) => {
      const product = productsById.get(String(item.productId));
      if (!product) {
        const error = new Error('Uno de los productos no existe o no pertenece al complejo.');
        error.status = 400;
        throw error;
      }

      const quantity = Math.max(1, Number(item.quantity) || 1);
      if (Number(product.stock || 0) < quantity) {
        const error = new Error(`Stock insuficiente para ${product.name}.`);
        error.status = 409;
        throw error;
      }

      return {
        productId: product._id,
        quantity,
        price: Number(product.price || 0),
      };
    });

    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const newOrder = new Order({
      userId: req.dbUser._id,
      complexId,
      externalReference: `draft-order:${req.dbUser._id}:${Date.now()}`,
      items: normalizedItems,
      totalAmount,
      status: 'pending',
    });

    newOrder.externalReference = buildExternalReference(newOrder._id.toString());
    await newOrder.save();

    res.status(201).json({
      order: newOrder,
      message: 'Pedido creado con exito. Falta completar el pago.',
      paymentSession: serializeOrderPaymentSession(newOrder, req.dbUser, complex, paymentProvider),
      providerConfigured: paymentProvider.configured === true,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Error al procesar la orden',
      detail: error.message,
    });
  }
};

export const processOrderPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { formData, additionalData } = req.body;

    if (!formData?.token) {
      return res.status(400).json({ error: 'formData es requerido para procesar el pago.' });
    }

    const localOrder = await loadOrderForUser(id, req.dbUser);
    await assertComplexClientAccess(localOrder.complexId?._id || localOrder.complexId, { createBillingIfMissing: true });
    const paymentProvider = await getOwnerPaymentProvider(localOrder.complexId.ownerId);

    if (!paymentProvider.configured || paymentProvider.accountSummary?.ordersEnabled === false) {
      return res.status(409).json({
        error: 'El complejo todavia no tiene cobros online configurados para la tienda.',
      });
    }

    const mercadoPagoOrder = await createAutomaticMercadoPagoOrder({
      externalReference: localOrder.externalReference,
      totalAmount: localOrder.totalAmount,
      currency: 'ARS',
      description: buildOrderDescription(localOrder, localOrder.complexId),
      payer: {
        email: formData?.payer?.email || req.dbUser.email,
        identification: formData?.payer?.identification || undefined,
      },
      formData,
      additionalData,
      notificationPath: '/api/orders/webhook/mercadopago',
      accessToken: paymentProvider.accessToken,
    });

    const syncedOrder = await syncLocalOrderFromMercadoPagoOrder(localOrder, mercadoPagoOrder);

    res.json({
      message: 'Pago del pedido procesado correctamente.',
      order: syncedOrder,
      paymentSession: serializeOrderPaymentSession(
        syncedOrder,
        req.dbUser,
        localOrder.complexId,
        paymentProvider,
      ),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Error al cobrar el pedido',
      detail: error.message,
    });
  }
};

export const handleMercadoPagoOrderWebhook = async (req, res) => {
  try {
    if (!validateMercadoPagoWebhookSignature(req)) {
      return res.status(401).json({ received: false, error: 'Firma de webhook invalida.' });
    }

    const orderId = extractMercadoPagoOrderId({
      ...req.body,
      query: req.query,
    });

    if (!orderId) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const localOrder = await Order.findOne({ mercadoPagoOrderId: String(orderId) })
      .populate('complexId', 'ownerId');

    if (!localOrder) {
      return res.status(200).json({ received: true, ignored: true, reason: 'order_not_found' });
    }

    const paymentProvider = await getOwnerPaymentProvider(localOrder.complexId?.ownerId);
    if (!paymentProvider.configured) {
      return res.status(200).json({ received: true, ignored: true, reason: 'payment_account_not_configured' });
    }

    const mercadoPagoOrder = await getMercadoPagoOrder(orderId, paymentProvider.accessToken);

    const syncedOrder = await syncLocalOrderFromMercadoPagoOrder(localOrder, mercadoPagoOrder);

    res.status(200).json({ received: true, order: syncedOrder });
  } catch (error) {
    res.status(200).json({
      received: true,
      error: error.message,
    });
  }
};

export const getOrders = async (req, res) => {
  try {
    const filter = {};

    if (req.dbUser.role === 'client') {
      filter.userId = req.dbUser._id;
    } else if (req.dbUser.role === 'owner') {
      const ownedComplexes = await Complex.find({ ownerId: req.dbUser._id }).select('_id');
      const ownedComplexIds = ownedComplexes.map((complex) => complex._id.toString());

      if (ownedComplexIds.length === 0) {
        return res.json([]);
      }

      if (req.query.complexId) {
        if (!ownedComplexIds.includes(String(req.query.complexId))) {
          return res.status(403).json({ error: 'No autorizado para ver ordenes de ese complejo.' });
        }
        filter.complexId = req.query.complexId;
      } else {
        filter.complexId = { $in: ownedComplexIds };
      }
    } else if (req.query.complexId) {
      filter.complexId = req.query.complexId;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const orders = await Order.find(filter)
      .populate('complexId', 'name')
      .populate('userId', 'displayName email')
      .populate('items.productId', 'name')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial de ordenes', detail: error.message });
  }
};
