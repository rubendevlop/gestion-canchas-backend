import Order from '../models/Order.js';

// Crear una nueva orden (Checkout Ecommerce / Reservas)
export const createOrder = async (req, res) => {
  try {
    const { complexId, items, totalAmount } = req.body;
    
    // Por ahora, simulamos el pago dejando en pendiente o completado según llegue
    // Más adelante aquí se conectaría con la API de Mercado Pago
    const newOrder = new Order({
      userId: req.dbUser._id, // Viene del token de auth y requireRole
      complexId,
      items,
      totalAmount,
      status: 'pending' // En el futuro 'pending' pasa a 'completed' vía Webhook de MP
    });

    await newOrder.save();
    
    // Simular integración futura con Mercado Pago devolviendo un "preferenceId" quemado
    res.status(201).json({
      order: newOrder,
      message: 'Orden creada con éxito (simulando que aún falta pago)',
      initPoint: 'https://sandbox.mercadopago.com.ar/sandbox/init_point'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar la orden', detail: error.message });
  }
};

// Obtener las órdenes de un usuario o del complejo
export const getOrders = async (req, res) => {
  try {
    const filter = {};
    
    // Si el que llama es "cliente", solo ve sus órdenes
    if (req.dbUser.role === 'client') {
      filter.userId = req.dbUser._id;
    } 
    // Si es "owner", ve las órdenes de su complejo (o lo pasamos por query params si administra varios)
    else if (req.dbUser.role === 'owner') {
       if (req.query.complexId) {
           filter.complexId = req.query.complexId;
       }
    }

    const orders = await Order.find(filter)
        .populate('complexId', 'name')
        .populate('userId', 'displayName email');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial de órdenes', detail: error.message });
  }
};
