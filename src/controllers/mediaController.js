import { createSignedUploadParams } from '../utils/cloudinary.js';

export const signCloudinaryUpload = async (req, res) => {
  try {
    const { entityType } = req.body || {};

    if (!entityType) {
      return res.status(400).json({ message: 'entityType es requerido.' });
    }

    const payload = createSignedUploadParams(entityType);
    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'No se pudo firmar la carga de imagen.',
    });
  }
};
