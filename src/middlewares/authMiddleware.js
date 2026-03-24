import admin from 'firebase-admin';

// Requerirá que en producción el servidor tenga la variable de entorno FIREBASE_SERVICE_ACCOUNT_BASE64
try {
  if (!admin.apps.length) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        // Vercel: decodificamos el JSON desde la var de entorno base64
        const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('ascii'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else {
        // Entorno local usando Application Default Credentials
        admin.initializeApp({
          credential: admin.credential.applicationDefault() 
        });
      }
  }
} catch (error) {
  console.log("⚠️ FIREBASE NO INICIALIZADO. Variable FIREBASE_SERVICE_ACCOUNT_BASE64 faltante o ApplicationDefault fallido.");
}

export const verifyAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta el token de autenticación' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error validando token: ", error);
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};
