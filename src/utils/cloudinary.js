import { v2 as cloudinary } from 'cloudinary';

const ENTITY_FOLDERS = {
  product: 'gestion-canchas/products',
  court: 'gestion-canchas/courts',
};

function getConfig() {
  return {
    cloudName: String(process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
    apiKey: String(process.env.CLOUDINARY_API_KEY || '').trim(),
    apiSecret: String(process.env.CLOUDINARY_API_SECRET || '').trim(),
  };
}

const { cloudName, apiKey, apiSecret } = getConfig();

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export function isCloudinaryConfigured() {
  const config = getConfig();
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

export function resolveCloudinaryFolder(entityType) {
  const folder = ENTITY_FOLDERS[entityType];
  if (!folder) {
    const error = new Error('Tipo de carga no soportado.');
    error.status = 400;
    throw error;
  }
  return folder;
}

export function createSignedUploadParams(entityType) {
  if (!isCloudinaryConfigured()) {
    const error = new Error('Cloudinary no esta configurado en el backend.');
    error.status = 503;
    throw error;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = resolveCloudinaryFolder(entityType);
  const paramsToSign = {
    folder,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, getConfig().apiSecret);

  return {
    cloudName: getConfig().cloudName,
    apiKey: getConfig().apiKey,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${getConfig().cloudName}/image/upload`,
  };
}

export async function destroyCloudinaryAsset(publicId) {
  if (!publicId || !isCloudinaryConfigured()) {
    return null;
  }

  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });
  } catch {
    return null;
  }
}
