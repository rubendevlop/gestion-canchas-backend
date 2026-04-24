export const COURT_FEATURES = [
  'Techada',
  'Con iluminacion',
  'Cesped sintetico',
  'Cesped natural',
  'Piso de cemento',
  'Parquet',
  'Indoor',
  'Outdoor',
  'Apta para torneo',
  'Apta para entrenamiento',
];

function normalizeCourtFeatureValue(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const COURT_FEATURES_MAP = new Map(
  COURT_FEATURES.map((feature) => [normalizeCourtFeatureValue(feature), feature]),
);

export function sanitizeCourtFeatures(value = []) {
  const list = Array.isArray(value) ? value : [value];
  const normalized = list
    .map((item) => COURT_FEATURES_MAP.get(normalizeCourtFeatureValue(item)))
    .filter(Boolean);

  return [...new Set(normalized)];
}
