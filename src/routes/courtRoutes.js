import express from 'express';
import { getCourts, createCourt } from '../controllers/courtController.js';
import { verifyAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getCourts); // Público: Ver canchas disponibles
router.post('/', verifyAuth, createCourt); // Privado: Agregar canchas

export default router;
