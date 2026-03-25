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

connectDB();

const app = express();
const PORT = process.env.PORT || 4000;

<<<<<<< HEAD
// Configuración de Middlewares
app.use(cors({
  origin: ['https://clubestucuman.ar',],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
=======
const allowedOrigins = [
  'https://clubestucuman.netlify.app',
  String(process.env.FRONTEND_URL || '').replace(/\/$/, ''),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      const normalizedOrigin = String(origin || '').replace(/\/$/, '');

      if (
        !origin ||
        allowedOrigins.includes(normalizedOrigin) ||
        /\.vercel\.app$/.test(normalizedOrigin) ||
        /\.netlify\.app$/.test(normalizedOrigin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

>>>>>>> 665e95b (cargando a github)
app.use(express.json());

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

app.get('/', (req, res) => {
  res.send('API de Gestion Canchas funcionando correctamente');
});

app.get('/api/secure/dashboard', verifyAuth, (req, res) => {
  res.json({
    message: 'Esta informacion solo puede verla un usuario logueado',
    user: req.user,
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor ejecutandose en el puerto ${PORT}`);
  });
}

export default app;
