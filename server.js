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

// Configuración de Middlewares
const allowedOrigins = [
  'https://clubestucuman.ar',
  'https://www.clubestucuman.ar',
  String(process.env.FRONTEND_URL || '').replace(/\/$/, ''),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, cURL, Netlify Functions)
      if (!origin) return callback(null, true);

      const normalized = String(origin).replace(/\/$/, '');

      if (
        allowedOrigins.includes(normalized) ||
        /\.netlify\.app$/.test(normalized) ||
        /^http:\/\/localhost(:\d+)?$/.test(normalized)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origen no permitido → ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

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
  res.send('API de Clubes Tucumán funcionando correctamente');
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
