const JSON_BODY_LIMIT = '256kb';
const RATE_LIMIT_HEADERS = {
  auth: {
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: 'Demasiados intentos de autenticacion. Espera unos minutos antes de reintentar.',
  },
  general: {
    windowMs: 60 * 1000,
    max: 240,
    message: 'Se alcanzo el limite de peticiones temporales. Espera un minuto antes de continuar.',
  },
  mutations: {
    windowMs: 5 * 60 * 1000,
    max: 30,
    message: 'Se alcanzo el limite de operaciones sensibles. Espera unos minutos antes de reintentar.',
  },
};

function normalizeOrigin(value = '') {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

function normalizeBoolean(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function parseOriginList(value = '') {
  return String(value || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

function getClientKey(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const rawIp = forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
  return rawIp.replace(/^::ffff:/, '');
}

function setRateLimitHeaders(res, { max, remaining, resetAt }) {
  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(remaining, 0)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
}

function buildAllowedOrigins() {
  const allowed = new Set(
    [
      'https://clubestucuman.ar',
      'https://www.clubestucuman.ar',
      normalizeOrigin(process.env.FRONTEND_URL),
      ...parseOriginList(process.env.FRONTEND_PREVIEW_ORIGINS),
    ].filter(Boolean),
  );

  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
  }

  return allowed;
}

function shouldAllowPreviewOrigin(origin = '') {
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  return (
    (normalizeBoolean(process.env.ALLOW_NETLIFY_PREVIEW_ORIGINS) &&
      /\.netlify\.app$/i.test(normalized)) ||
    (normalizeBoolean(process.env.ALLOW_VERCEL_PREVIEW_ORIGINS) &&
      /\.vercel\.app$/i.test(normalized))
  );
}

function shouldSkipMutationLimiter(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(req.method || '').toUpperCase())) {
    return true;
  }

  return String(req.path || '').startsWith('/webhook/mercadopago');
}

function shouldSkipGeneralLimiter(req) {
  return String(req.path || '').startsWith('/reservations/webhook/mercadopago');
}

function cleanupExpiredEntries(store, now) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

function createMemoryRateLimit({
  windowMs,
  max,
  message,
  errorCode = 'RATE_LIMITED',
  keyPrefix = 'api',
  skip = () => false,
} = {}) {
  const store = new Map();
  let requestCounter = 0;

  return (req, res, next) => {
    if (req.method === 'OPTIONS' || skip(req)) {
      return next();
    }

    const now = Date.now();
    requestCounter += 1;

    if (requestCounter % 200 === 0) {
      cleanupExpiredEntries(store, now);
    }

    const key = `${keyPrefix}:${getClientKey(req)}`;
    const currentEntry = store.get(key);

    if (!currentEntry || currentEntry.resetAt <= now) {
      const nextEntry = {
        count: 1,
        resetAt: now + windowMs,
      };

      store.set(key, nextEntry);
      setRateLimitHeaders(res, {
        max,
        remaining: max - nextEntry.count,
        resetAt: nextEntry.resetAt,
      });
      return next();
    }

    currentEntry.count += 1;
    setRateLimitHeaders(res, {
      max,
      remaining: max - currentEntry.count,
      resetAt: currentEntry.resetAt,
    });

    if (currentEntry.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((currentEntry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: errorCode,
        message,
      });
    }

    return next();
  };
}

export function applySecurityHeaders(req, res, next) {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');

  if (req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

export function createCorsOptions() {
  const allowedOrigins = buildAllowedOrigins();

  return {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.has(normalizedOrigin) || shouldAllowPreviewOrigin(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS: origen no permitido -> ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

export function getJsonBodyLimit() {
  return JSON_BODY_LIMIT;
}

export const generalApiRateLimit = createMemoryRateLimit({
  ...RATE_LIMIT_HEADERS.general,
  keyPrefix: 'general',
  skip: shouldSkipGeneralLimiter,
});

export const authRateLimit = createMemoryRateLimit({
  ...RATE_LIMIT_HEADERS.auth,
  keyPrefix: 'auth',
});

export const mutationRateLimit = createMemoryRateLimit({
  ...RATE_LIMIT_HEADERS.mutations,
  keyPrefix: 'mutation',
  skip: shouldSkipMutationLimiter,
});
