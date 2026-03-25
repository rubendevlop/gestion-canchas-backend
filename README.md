# gestion-canchas

## Netlify

Este repo quedo preparado para desplegarse en un solo sitio de Netlify:

- `frontend` se publica como sitio estatico.
- `backend` corre como Netlify Function en `/.netlify/functions/api`.
- Las rutas del frontend consumen `/api/*` en el mismo dominio.

### Build settings

- Build command: `npm run build`
- Publish directory: `frontend/dist`

`netlify.toml` ya contiene:

- rewrite de `/api/*` hacia la Function Express
- fallback SPA para React Router
- configuracion de Functions con `esbuild`

### Variables de entorno

Carga en Netlify las variables del backend:

- `MONGO_URI`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `FRONTEND_URL`
- `BACKEND_PUBLIC_URL`
- `OWNER_MONTHLY_FEE_ARS`
- `OWNER_MONTHLY_FEE_CURRENCY`
- `OWNER_PAYMENT_GRACE_DAYS`
- `OWNER_BILLING_CYCLE_MONTHS`
- `MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_TEST_PAYER_EMAIL`
- `PAYMENT_ACCOUNT_ENCRYPTION_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Y las del frontend:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

En Netlify puedes omitir `VITE_API_URL` para que use `/api` en el mismo dominio.
