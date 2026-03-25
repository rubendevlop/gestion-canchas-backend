import { fetchAPI } from './api';

export async function uploadImageToCloudinary(file, entityType) {
  if (!file) {
    throw new Error('No se selecciono ninguna imagen.');
  }

  const signature = await fetchAPI('/media/sign-upload', {
    method: 'POST',
    body: JSON.stringify({ entityType }),
  });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signature.apiKey);
  formData.append('timestamp', String(signature.timestamp));
  formData.append('signature', signature.signature);
  formData.append('folder', signature.folder);

  const response = await fetch(signature.uploadUrl, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || 'Cloudinary rechazo la imagen.');
  }

  return {
    image: data.secure_url || '',
    imagePublicId: data.public_id || '',
    width: data.width || null,
    height: data.height || null,
  };
}
