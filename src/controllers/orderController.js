import Complex from '../models/Complex.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { sendOrderPaidEmail } from '../utils/emailNotifications.js';
import { getOwnerPaymentProvider } from '../utils/paymentAccounts.js';
import { validateMercadoPagoWebhookSignature } from '../utils/mercadoPago.js';
import {
  assertComplexClientAccess,
} from '../utils/ownerBilling.js';
import {
  buildWebhookUrl,
  createCheckoutPreference,
  extractMercadoPagoPaymentId,
  extractMercadoPagoOrderId,
  getFrontendUrl,
  getMercadoPagoOrder,
  getMercadoPagoOrderSnapshot,
  getMercadoPagoPayment,
  getMercadoPagoPaymentSnapshot,
  isApprovedMercadoPagoOrder,
  isApprovedMercadoPagoPayment,
  isCancelledMercadoPagoOrder,
  isCancelledMercadoPagoPayment,
  isFailedMercadoPagoOrder,
  isFailedMercadoPagoPayment,
  isPendingMercadoPagoOrder,
  isPendingMercadoPagoPayment,
  resolveMercadoPagoPayerEmail,
} from '../utils/mercadoPago.js';

function buildExternalReference(orderId) {
  return `store-order-${orderId}`;
}

function buildOrderReturnUrl(order, complexId, result = 'pending') {
  const url = new URL('/portal/pago/mercadopago', `${getFrontendUrl()}/`);
  url.searchParams.set('entity', 'order');
  url.searchParams.set('id', String(order._id));
  url.searchParams.set('complexId', String(complexId || order.complexId || ''));
  url.searchParams.set('result', String(result || 'pending'));
  return url.toString();
}

function buildOrderNotificationUrl(order, complex) {
  const baseUrl = buildWebhookUrl('/api/orders/webhook/mercadopago');
  if (!baseUrl) {
    return '';
  }

  const url = new URL(baseUrl);
  url.searchParams.set('orderId', String(order._id));

  if (complex?.ownerId) {
    url.searchParams.set('ownerId', String(complex.ownerId));
  }

  return url.toString();
}

function buildOrderDescription(order, complex) {
  return `Pedido tienda ${complex?.name || 'Clubes Tucumán'} #${String(order._id).slice(-6).toUpperCase()}`;
}

function serializeOrderPaymentSession(order, user, complex, paymentProvider = {}, checkout = {}) {
  const payer = resolveMercadoPagoPayerEmail({
    fallbackEmail: user.email,
    providerMode: paymentProvider.accountSummary?.mode,
  });

  return {
    provider: 'mercadopago',
    checkoutMode: 'checkout_pro',
    providerConfigured: paymentProvider.configured === true,
    publicKey: paymentProvider.publicKey || '',
    orderId: order._id,
    preferenceId: checkout.preferenceId || order.mercadoPagoPreferenceId || '',
    checkoutUrl: checkout.checkoutUrl || '',
    amount: order.totalAmount,
    currency: 'ARS',
    description: buildOrderDescription(order, complex),
    payer: {
      email: payer.email,
      usesConfiguredTestEmail: payer.usesConfiguredTestEmail,
      requiresTestUser: payer.requiresTestUser,
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

function applyPaymentSnapshotToOrder(order, snapshot) {
  order.mercadoPagoPreferenceId = snapshot.preferenceId || order.mercadoPagoPreferenceId || '';
  order.mercadoPagoOrderId = snapshot.paymentOrderId || order.mercadoPagoOrderId || '';
  order.mercadoPagoPaymentId = snapshot.paymentId;
  order.mercadoPagoStatus = snapshot.paymentStatus;
  order.mercadoPagoStatusDetail = snapshot.paymentStatusDetail;
  order.mercadoPagoPaymentMethodId = snapshot.paymentMethodId;
  order.mercadoPagoPaymentMethodType = snapshot.paymentMethodType;
}

async function maybeSendOrderConfirmationEmail(order) {
  if (!order || order.status !== 'completed' || order.confirmationEmailSentAt) {
    return;
  }

  const hydratedOrder =
    order.userId?.email && order.complexId?.name
      ? order
      : await Order.findById(order._id)
          .populate('userId', 'displayName email')
          .populate('complexId', 'name')
          .populate('items.productId', 'name');

  if (!hydratedOrder?.userId?.email) {
    return;
  }

  const result = await sendOrderPaidEmail({
    order: hydratedOrder,
    user: hydratedOrder.userId,
    complex: hydratedOrder.complexId,
  });

  if (result?.sent) {
    order.confirmationEmailSentAt = new Date();
    await order.save();
  }
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
  await maybeSendOrderConfirmationEmail(localOrder);
  return localOrder;
}

async function syncLocalOrderFromMercadoPagoPayment(localOrder, mercadoPagoPayment) {
  const snapshot = getMercadoPagoPaymentSnapshot(mercadoPagoPayment);
  applyPaymentSnapshotToOrder(localOrder, snapshot);

  if (isApprovedMercadoPagoPayment(mercadoPagoPayment)) {
    localOrder.status = 'completed';
    localOrder.paidAt = snapshot.approvedAt ? new Date(snapshot.approvedAt) : new Date();
  } else if (isPendingMercadoPagoPayment(mercadoPagoPayment)) {
    localOrder.status = 'pending';
  } else if (isCancelledMercadoPagoPayment(mercadoPagoPayment)) {
    localOrder.status = 'cancelled';
  } else if (isFailedMercadoPagoPayment(mercadoPagoPayment)) {
    localOrder.status = 'failed';
  }

  await localOrder.save();
  await maybeSendOrderConfirmationEmail(localOrder);
  return localOrder;
}

async function createOrderCheckout(localOrder, user, complex, paymentProvider, productsById = new Map()) {
  const payer = resolveMercadoPagoPayerEmail({
    fallbackEmail: user.email,
    providerMode: paymentProvider.accountSummary?.mode,
  });

  const items = localOrder.items.map((item) => {
    const product = productsById.get(String(item.productId));
    return {
      id: String(item.productId),
      title: product?.name || 'Producto',
      description: buildOrderDescription(localOrder, complex),
      quantity: Number(item.quantity || 1),
      currency_id: 'ARS',
      unit_price: Number(item.price || 0),
      picture_url: product?.imageUrl || product?.image || product?.images?.[0] || undefined,
    };
  });

  const preference = await createCheckoutPreference({
    externalReference: localOrder.externalReference,
    accessToken: paymentProvider.accessToken,
    payer: {
      email: payer.email,
    },
    items,
    backUrls: {
      success: buildOrderReturnUrl(localOrder, localOrder.complexId?._id || localOrder.complexId, 'success'),
      pending: buildOrderReturnUrl(localOrder, localOrder.complexId?._id || localOrder.complexId, 'pending'),
      failure: buildOrderReturnUrl(localOrder, localOrder.complexId?._id || localOrder.complexId, 'failure'),
    },
    notificationUrl: buildOrderNotificationUrl(localOrder, complex),
    metadata: {
      entity: 'order',
      order_id: String(localOrder._id),
    },
  });

  localOrder.mercadoPagoPreferenceId = String(preference?.id || '');
  await localOrder.save();

  const checkoutUrl =
    paymentProvider.accountSummary?.mode === 'sandbox'
      ? String(preference?.sandbox_init_point || preference?.init_point || '')
      : String(preference?.init_point || preference?.sandbox_init_point || '');

  return {
    order: localOrder,
    paymentSession: serializeOrderPaymentSession(localOrder, user, complex, paymentProvider, {
      preferenceId: localOrder.mercadoPagoPreferenceId,
      checkoutUrl,
    }),
  };
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
      externalReference: `draft-order-${req.dbUser._id}-${Date.now()}`,
      items: normalizedItems,
      totalAmount,
      status: 'pending',
    });

    newOrder.externalReference = buildExternalReference(newOrder._id.toString());
    await newOrder.save();
    let checkout;
    try {
      checkout = await createOrderCheckout(
        newOrder,
        req.dbUser,
        complex,
        paymentProvider,
        productsById,
      );
    } catch (paymentError) {
      newOrder.status = 'failed';
      await newOrder.save();
      throw paymentError;
    }

    res.status(201).json({
      order: checkout.order,
      message: 'Pedido creado con exito. Falta completar el pago.',
      paymentSession: checkout.paymentSession,
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
    const localOrder = await loadOrderForUser(req.params.id, req.dbUser);
    await assertComplexClientAccess(localOrder.complexId?._id || localOrder.complexId, { createBillingIfMissing: true });
    const paymentProvider = await getOwnerPaymentProvider(localOrder.complexId.ownerId);

    if (!paymentProvider.configured || paymentProvider.accountSummary?.ordersEnabled === false) {
      return res.status(409).json({
        error: 'El complejo todavia no tiene cobros online configurados para la tienda.',
      });
    }

    const productIds = localOrder.items.map((item) => item.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productsById = new Map(products.map((product) => [String(product._id), product]));
    const checkout = await createOrderCheckout(localOrder, req.dbUser, localOrder.complexId, paymentProvider, productsById);

    res.json({
      message: 'Checkout generado correctamente.',
      order: checkout.order,
      paymentSession: checkout.paymentSession,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Error al cobrar el pedido',
      detail: error.message,
    });
  }
};

export const syncOrderPayment = async (req, res) => {
  try {
    const localOrder = await loadOrderForUser(req.params.id, req.dbUser);
    const paymentProvider = await getOwnerPaymentProvider(localOrder.complexId.ownerId);

    if (!paymentProvider.configured) {
      return res.status(409).json({
        error: 'La cuenta de cobro del complejo no esta disponible.',
      });
    }

    const paymentId = String(
      req.body?.paymentId ||
      req.body?.collectionId ||
      req.query?.payment_id ||
      req.query?.collection_id ||
      localOrder.mercadoPagoPaymentId ||
      '',
    ).trim();

    let syncedOrder = localOrder;

    if (paymentId) {
      const mercadoPagoPayment = await getMercadoPagoPayment(paymentId, paymentProvider.accessToken);
      syncedOrder = await syncLocalOrderFromMercadoPagoPayment(localOrder, mercadoPagoPayment);
    } else {
      const resultHint = String(req.body?.result || req.query?.result || '').toLowerCase();
      if (resultHint === 'failure' && syncedOrder.status !== 'completed') {
        syncedOrder.status = 'cancelled';
        await syncedOrder.save();
      }
    }

    res.json({
      message:
        syncedOrder.status === 'completed'
          ? 'Pago acreditado correctamente.'
          : syncedOrder.status === 'cancelled'
            ? 'El pedido fue cancelado.'
            : 'El pago sigue pendiente de confirmacion.',
      order: syncedOrder,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'No se pudo sincronizar el pago del pedido',
      detail: error.message,
    });
  }
};

export const handleMercadoPagoOrderWebhook = async (req, res) => {
  try {
    if (!validateMercadoPagoWebhookSignature(req)) {
      return res.status(401).json({ received: false, error: 'Firma de webhook invalida.' });
    }

    if (req.query?.orderId) {
      const localOrder = await Order.findById(req.query.orderId).populate('complexId', 'ownerId');

      if (!localOrder) {
        return res.status(200).json({ received: true, ignored: true, reason: 'order_not_found' });
      }

      const ownerId = req.query?.ownerId || localOrder.complexId?.ownerId;
      const paymentProvider = await getOwnerPaymentProvider(ownerId);
      if (!paymentProvider.configured) {
        return res.status(200).json({ received: true, ignored: true, reason: 'payment_account_not_configured' });
      }

      const paymentId = extractMercadoPagoPaymentId({
        ...req.body,
        query: req.query,
      });

      if (!paymentId) {
        return res.status(200).json({ received: true, ignored: true, reason: 'payment_id_missing' });
      }

      const mercadoPagoPayment = await getMercadoPagoPayment(paymentId, paymentProvider.accessToken);
      const syncedOrder = await syncLocalOrderFromMercadoPagoPayment(localOrder, mercadoPagoPayment);

      return res.status(200).json({ received: true, order: syncedOrder });
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
