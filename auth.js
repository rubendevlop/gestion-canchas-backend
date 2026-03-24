import admin from 'firebase-admin';

// Inicializar con credenciales default en local o con Service Account (Vercel)
if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      // Vercel u otro hosting: decodificamos el JSON desde la var de entorno base64
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
