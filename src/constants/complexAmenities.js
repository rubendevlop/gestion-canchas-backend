export const COMPLEX_AMENITIES = [
  'Wi-Fi',
  'Vestuario',
  'Estacionamiento',
  'Ba\u00f1os',
  'Bar',
  'Kiosco',
  'Parrilla',
  'Quincho',
  'Iluminaci\u00f3n nocturna',
  'Torneos',
];

function normalizeAmenityValue(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const AMENITIES_MAP = new Map(
  COMPLEX_AMENITIES.map((amenity) => [normalizeAmenityValue(amenity), amenity]),
);

export function sanitizeComplexAmenities(value = []) {
  const list = Array.isArray(value) ? value : [value];
  const normalized = list
    .map((item) => AMENITIES_MAP.get(normalizeAmenityValue(item)))
    .filter(Boolean);

  return [...new Set(normalized)];
}
