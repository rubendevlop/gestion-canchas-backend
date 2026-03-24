import admin from 'firebase-admin';

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
