import nodemailer from 'nodemailer';

let cachedTransporter = null;

function normalizeString(value = '') {
  return String(value || '').trim();
}

function parseBoolean(value, fallback = false) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMailerConfig() {
  return {
    host: normalizeString(process.env.SMTP_HOST),
    port: parseNumber(process.env.SMTP_PORT, 587),
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    user: normalizeString(process.env.SMTP_USER),
    pass: normalizeString(process.env.SMTP_PASS),
    fromEmail: normalizeString(process.env.SMTP_FROM_EMAIL),
    fromName: normalizeString(process.env.SMTP_FROM_NAME || 'Clubes Tucuman'),
    replyTo: normalizeString(process.env.SMTP_REPLY_TO),
    requireTls: parseBoolean(process.env.SMTP_REQUIRE_TLS, false),
    tlsRejectUnauthorized: parseBoolean(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true),
    connectionTimeout: parseNumber(process.env.SMTP_CONNECTION_TIMEOUT_MS, 15000),
    greetingTimeout: parseNumber(process.env.SMTP_GREETING_TIMEOUT_MS, 10000),
    socketTimeout: parseNumber(process.env.SMTP_SOCKET_TIMEOUT_MS, 20000),
  };
}

export function isMailerConfigured() {
  const config = getMailerConfig();
  return Boolean(config.host && config.port && config.fromEmail);
}

function buildTransporter() {
  const config = getMailerConfig();
  if (!isMailerConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    requireTLS: config.requireTls,
    connectionTimeout: config.connectionTimeout,
    greetingTimeout: config.greetingTimeout,
    socketTimeout: config.socketTimeout,
    tls: config.tlsRejectUnauthorized ? undefined : { rejectUnauthorized: false },
  });
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = buildTransporter();
  return cachedTransporter;
}

function getSender() {
  const config = getMailerConfig();
  return {
    from: `"${config.fromName}" <${config.fromEmail}>`,
    replyTo: config.replyTo || undefined,
  };
}

export async function sendEmail({ to, subject, html, text, replyTo } = {}) {
  if (!to) {
    throw new Error('El destinatario del email es obligatorio.');
  }

  if (!isMailerConfigured()) {
    return { sent: false, skipped: true, reason: 'mailer_not_configured' };
  }

  const transporter = getTransporter();
  const sender = getSender();

  const info = await transporter.sendMail({
    from: sender.from,
    to,
    subject: normalizeString(subject || 'Notificacion Clubes Tucuman'),
    text: text || undefined,
    html: html || undefined,
    replyTo: replyTo || sender.replyTo,
  });

  return {
    sent: true,
    messageId: info.messageId,
  };
}

export async function sendEmailSafe(payload) {
  try {
    return await sendEmail(payload);
  } catch (error) {
    console.error('Email send failed:', error.message);
    return {
      sent: false,
      error: error.message,
    };
  }
}
