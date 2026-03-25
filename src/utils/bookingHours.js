const DEFAULT_START_HOUR = 8;
const DEFAULT_SLOT_COUNT = 16;

function buildDefaultBookingHours() {
  return Array.from({ length: DEFAULT_SLOT_COUNT }, (_, index) =>
    `${String(DEFAULT_START_HOUR + index).padStart(2, '0')}:00`,
  );
}

export const DEFAULT_BOOKING_HOURS = buildDefaultBookingHours();

const HOUR_PATTERN = /^(?:[01]\d|2[0-3]):00$/;

export function normalizeBookingHours(value) {
  const normalized = Array.isArray(value)
    ? value
        .map((hour) => String(hour || '').trim())
        .filter((hour) => HOUR_PATTERN.test(hour))
    : [];

  const uniqueSorted = [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
  return uniqueSorted.length > 0 ? uniqueSorted : [...DEFAULT_BOOKING_HOURS];
}
