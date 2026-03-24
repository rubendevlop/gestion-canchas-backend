import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import { verifyAuth } from './src/middlewares/authMiddleware.js';
import courtRoutes from './src/routes/courtRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import reservationRoutes from './src/routes/reservationRoutes.js';

dotenv.config();

// Inicializar BD
connectDB();

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de Middlewares
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Montaje de Rutas de la API
app.use('/api/courts', courtRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reservations', reservationRoutes);

// Ruta Base
app.get('/', (req, res) => {
  res.send('API de Gestión Canchas funcionando correctamente');
});

// Ruta Protegida de prueba
app.get('/api/secure/dashboard', verifyAuth, (req, res) => {
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
