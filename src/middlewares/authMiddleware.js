import admin from 'firebase-admin';
import { resolveDbUser } from '../utils/resolveDbUser.js';

let firebaseInitError = null;

const initializeFirebase = () => {
  if (admin.apps.length) {
    return admin.app();
  }

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    }

    firebaseInitError = null;
    return admin.app();
  } catch (error) {
    firebaseInitError = error;
    console.error('Firebase Admin no pudo inicializarse:', error.message);
    return null;
  }
};

initializeFirebase();

export const verifyAuth = async (req, res, next) => {
  if (!initializeFirebase()) {
    return res.status(500).json({
      error: 'Firebase Admin no esta configurado correctamente',
      detail: firebaseInitError?.message
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta el token de autenticacion' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error validando token:', error);
    return res.status(403).json({ error: 'Token invalido o expirado' });
  }
};

export const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.uid) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }
      
      const user = await resolveDbUser(req.user);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no existe en la base de datos' });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Permisos insuficientes para esta acción' });
      }

      // Adjuntar el usuario de la DB para uso posterior
      req.dbUser = user;
      next();
    } catch (error) {
      console.error('Error verificando roles:', error);
      res.status(500).json({ error: 'Error validando permisos de usuario' });
    }
  };
};
