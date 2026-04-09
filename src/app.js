import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import { verifyAuth } from './middlewares/authMiddleware.js';
import {
  applySecurityHeaders,
  authRateLimit,
  createCorsOptions,
  generalApiRateLimit,
  getJsonBodyLimit,
  mutationRateLimit,
} from './middlewares/securityMiddleware.js';
import courtRoutes from './routes/courtRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import complexRoutes from './routes/complexRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import ownerBillingRoutes from './routes/ownerBillingRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import paymentAccountRoutes from './routes/paymentAccountRoutes.js';

export default function createApp({ connectDatabasePerRequest = false } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(applySecurityHeaders);
  app.use(cors(createCorsOptions()));
  app.use('/api', generalApiRateLimit);
  app.use('/api/users/login', authRateLimit);
  app.use('/api/users/register', authRateLimit);
  app.use('/api/reservations', mutationRateLimit);
  app.use('/api/orders', mutationRateLimit);
  app.use('/api/media/sign-upload', mutationRateLimit);
  app.use(express.json({ limit: getJsonBodyLimit() }));

  if (connectDatabasePerRequest) {
    app.use(async (req, res, next) => {
      try {
        await connectDB();
        next();
      } catch (error) {
        next(error);
      }
    });
  }

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
    res.send('API de Clubes Tucuman funcionando correctamente');
  });

  app.get('/api/secure/dashboard', verifyAuth, (req, res) => {
    res.json({
      message: 'Esta informacion solo puede verla un usuario logueado',
      user: req.user,
    });
  });

  app.use((error, req, res, next) => {
    if (!error) {
      return next();
    }

    if (error.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: 'El cuerpo de la peticion supera el tamano permitido.',
      });
    }

    if (String(error.message || '').startsWith('CORS:')) {
      return res.status(403).json({
        error: 'CORS_NOT_ALLOWED',
        message: 'El origen de la peticion no esta permitido.',
      });
    }

    return res.status(error.status || 500).json({
      error: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Error interno del servidor.',
    });
  });

  return app;
}
