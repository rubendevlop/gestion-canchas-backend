import express from 'express';
import cors from 'cors';
import './src/config/loadEnv.js';
import connectDB from './src/config/db.js';
import { verifyAuth } from './src/middlewares/authMiddleware.js';
import courtRoutes from './src/routes/courtRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import reservationRoutes from './src/routes/reservationRoutes.js';
import complexRoutes from './src/routes/complexRoutes.js';
import productRoutes from './src/routes/productRoutes.js';
import orderRoutes from './src/routes/orderRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import ownerBillingRoutes from './src/routes/ownerBillingRoutes.js';
import mediaRoutes from './src/routes/mediaRoutes.js';
import paymentAccountRoutes from './src/routes/paymentAccountRoutes.js';

// Inicializar BD
connectDB();

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de Middlewares
app.use(cors({
  origin: ['https://clubestucuman.ar',],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Montaje de Rutas de la API
app.use('/api/courts', courtRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/complexes', complexRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/owner-billing', ownerBillingRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/payment-account', paymentAccountRoutes);

// Ruta Base
app.get('/', (req, res) => {
  res.send('API de Gestión Canchas funcionando correctamente');
});

// Ruta Protegida de prueba
app.get('/api/login', verifyAuth, (req, res) => {
  res.json({
    message: 'Esta información solo puede verla un usuario logueado',
    user: req.user
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
  });
}

export default app;
