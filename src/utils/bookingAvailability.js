import { normalizeBookingHours } from './bookingHours.js';

export const DEFAULT_BOOKING_TIME_ZONE =
  String(process.env.BOOKING_TIME_ZONE || '').trim() || 'America/Argentina/Buenos_Aires';

const BOOKING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BOOKING_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function toTwoDigits(value) {
  return String(value).padStart(2, '0');
}

function getDateTimePartsInTimeZone(date = new Date(), timeZone = DEFAULT_BOOKING_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date).reduce((accumulator, part) => {
    if (part.type !== 'literal') {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function normalizeBookingDate(value = '') {
  const normalized = String(value || '').trim();
  if (!BOOKING_DATE_PATTERN.test(normalized)) {
    return '';
  }

  const [year, month, day] = normalized.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return '';
  }

  return normalized;
}

export function toBookingDateUtc(value = '') {
  const normalized = normalizeBookingDate(value);
  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function serializeBookingDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return normalizeBookingDate(value);
}

export function getTodayBookingDate(options = {}) {
  return getDateTimePartsInTimeZone(options.now, options.timeZone).date;
}

export function isBookingTimeFormat(value = '') {
  return BOOKING_TIME_PATTERN.test(String(value || '').trim());
}

export function isBookingSlotInPast({ date, startTime, now = new Date(), timeZone } = {}) {
  const bookingDate = serializeBookingDate(date);
  const bookingTime = String(startTime || '').trim();

  if (!bookingDate || !isBookingTimeFormat(bookingTime)) {
    return false;
  }

  const current = getDateTimePartsInTimeZone(now, timeZone);
  if (bookingDate < current.date) {
    return true;
  }

  if (bookingDate > current.date) {
    return false;
  }

  return bookingTime <= current.time;
}

export function getPastBookingHoursForDate(bookingHours, bookingDate, options = {}) {
  const normalizedBookingDate = serializeBookingDate(bookingDate);
  if (!normalizedBookingDate) {
    return [];
  }

  const normalizedHours = normalizeBookingHours(bookingHours);
  const current = getDateTimePartsInTimeZone(options.now, options.timeZone);

  if (normalizedBookingDate < current.date) {
    return normalizedHours;
  }

  if (normalizedBookingDate > current.date) {
    return [];
  }

  return normalizedHours.filter((hour) => hour <= current.time);
}

export function buildHourRangeFromStart(startTime = '') {
  if (!isBookingTimeFormat(startTime)) {
    return '';
  }

  const [hour, minute] = String(startTime).split(':').map(Number);
  return `${toTwoDigits(hour + 1)}:${toTwoDigits(minute)}`;
}
