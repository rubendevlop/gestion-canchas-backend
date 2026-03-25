# Cloudinary setup

## Variables

Estas variables van solo en el backend:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

No hace falta exponer ningun secreto en el frontend. La subida se firma desde el backend y el archivo se sube directo a Cloudinary.

## Donde sacar las claves

1. Entra a `https://console.cloudinary.com/`
2. En `Dashboard` vas a ver el `Cloud name`
3. En `Settings > API Keys` vas a ver:
   - `API Key`
   - `API Secret`

## Flujo que usa este proyecto

1. El owner elige una imagen para una cancha o producto.
2. El frontend le pide al backend una firma en `POST /api/media/sign-upload`.
3. El backend firma la subida con Cloudinary y devuelve:
   - `cloudName`
   - `apiKey`
   - `timestamp`
   - `folder`
   - `signature`
   - `uploadUrl`
4. El frontend sube el archivo directo a Cloudinary.
5. Cloudinary responde con:
   - `secure_url`
   - `public_id`
6. El frontend guarda esos valores en la entidad:
   - `image`
   - `imagePublicId`
7. Si despues reemplazas o borras la entidad, el backend elimina la imagen vieja usando `public_id`.

## Carpetas usadas

- Productos: `gestion-canchas/products`
- Canchas: `gestion-canchas/courts`

## En local

Completa las variables en:

- `backend/.env.local`

Despues reinicia el backend.

## En produccion

Si usas Vercel, agrega las mismas variables en `Project Settings > Environment Variables`.

## Endpoints relacionados

- `POST /api/media/sign-upload`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `POST /api/courts`
- `PUT /api/courts/:id`
- `DELETE /api/courts/:id`

## Notas

- El secreto de Cloudinary nunca debe ir al frontend.
- La imagen se sube a Cloudinary solo al guardar el formulario.
- Al reemplazar una imagen, se intenta borrar la anterior automaticamente.
