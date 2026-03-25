import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { assertComplexClientAccess } from '../utils/ownerBilling.js';

export const createOrder = async (req, res) => {
  try {
    const { complexId, items = [] } = req.body;

    if (!complexId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'complexId e items son requeridos.' });
    }

    await assertComplexClientAccess(complexId, { createBillingIfMissing: true });

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

      return {
        productId: product._id,
        quantity: Math.max(1, Number(item.quantity) || 1),
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
      items: normalizedItems,
      totalAmount,
      status: 'pending',
    });

    await newOrder.save();

    res.status(201).json({
      order: newOrder,
      message: 'Orden creada con exito (pendiente de pago).',
      initPoint: 'https://sandbox.mercadopago.com.ar/sandbox/init_point',
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Error al procesar la orden',
      detail: error.message,
    });
  }
};

export const getOrders = async (req, res) => {
  try {
    const filter = {};

    if (req.dbUser.role === 'client') {
      filter.userId = req.dbUser._id;
    } else if (req.dbUser.role === 'owner' && req.query.complexId) {
      filter.complexId = req.query.complexId;
    }

    const orders = await Order.find(filter)
      .populate('complexId', 'name')
      .populate('userId', 'displayName email');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial de ordenes', detail: error.message });
  }
};
