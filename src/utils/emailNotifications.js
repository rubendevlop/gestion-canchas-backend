import { sendEmailSafe } from './mailer.js';

function normalizeString(value = '') {
  return String(value || '').trim();
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`;
}

function formatDate(value) {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function wrapEmail(title, bodyLines = []) {
  const body = bodyLines.map((line) => `<p style="margin:0 0 12px;">${line}</p>`).join('');

  return `
    <div style="font-family:Arial,sans-serif;background:#f4f7ef;padding:32px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #e3ead8;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5b6f58;">Clubes Tucuman</p>
        <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;color:#1f2c1f;">${title}</h1>
        <div style="font-size:15px;line-height:1.6;color:#425141;">
          ${body}
        </div>
      </div>
    </div>
  `;
}

function getAdminNotificationRecipients() {
  return normalizeString(process.env.ADMIN_NOTIFY_EMAIL)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function sendAdminNotification({ subject, text, html }) {
  const recipients = getAdminNotificationRecipients();
  if (recipients.length === 0) {
    return { sent: false, skipped: true, reason: 'missing_admin_notify_email' };
  }

  return sendEmailSafe({
    to: recipients.join(', '),
    subject,
    text,
    html,
  });
}

export async function sendWelcomeEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };

  const displayName = user.displayName || user.email;
  return sendEmailSafe({
    to: user.email,
    subject: 'Bienvenido a Clubes Tucuman',
    text: `Hola ${displayName}, tu cuenta ya esta lista para usar Clubes Tucuman.`,
    html: wrapEmail('Bienvenido a Clubes Tucuman', [
      `Hola <strong>${displayName}</strong>.`,
      'Tu cuenta ya esta lista para reservar canchas, comprar productos y seguir tu actividad desde el portal.',
    ]),
  });
}

export async function sendOwnerApplicationPendingEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };

  const application = user.ownerApplication || {};
  return sendEmailSafe({
    to: user.email,
    subject: 'Recibimos tu solicitud como owner',
    text: `Recibimos tu solicitud para ${application.complexName || 'tu complejo'} y ahora esta pendiente de revision.`,
    html: wrapEmail('Recibimos tu solicitud como owner', [
      `Tu solicitud para operar <strong>${application.complexName || 'tu complejo'}</strong> fue recibida correctamente.`,
      'Nuestro equipo la revisara y te avisaremos por correo cuando quede aprobada.',
      `Ciudad declarada: <strong>${application.city || '-'}</strong>.`,
      `Contacto: <strong>${application.contactPhone || user.phone || user.email}</strong>.`,
    ]),
  });
}

export async function sendAdminOwnerApplicationEmail(user) {
  const application = user?.ownerApplication || {};

  return sendAdminNotification({
    subject: 'Nueva solicitud de owner',
    text: `Nueva solicitud owner: ${user?.displayName || user?.email} - ${application.complexName || 'Sin complejo'}.`,
    html: wrapEmail('Nueva solicitud de owner', [
      `Se registro una nueva solicitud owner de <strong>${user?.displayName || user?.email || 'Usuario'}</strong>.`,
      `Complejo: <strong>${application.complexName || '-'}</strong>.`,
      `Documento: <strong>${application.documentType || '-'} ${application.documentNumber || ''}</strong>.`,
      `Telefono: <strong>${application.contactPhone || '-'}</strong>.`,
      `Ciudad: <strong>${application.city || '-'}</strong>.`,
      `Canchas declaradas: <strong>${application.courtsCount || 0}</strong>.`,
    ]),
  });
}

export async function sendOwnerStatusEmail(user, status, note = '') {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };

  const normalizedStatus = String(status || '').toUpperCase();
  const isApproved = normalizedStatus === 'APPROVED';

  return sendEmailSafe({
    to: user.email,
    subject: isApproved ? 'Tu cuenta owner fue aprobada' : 'Actualizacion sobre tu cuenta owner',
    text: isApproved
      ? 'Tu cuenta owner fue aprobada y ya puedes continuar con la configuracion del complejo.'
      : `Tu cuenta owner fue marcada como ${normalizedStatus}. ${note || ''}`.trim(),
    html: wrapEmail(
      isApproved ? 'Tu cuenta owner fue aprobada' : 'Actualizacion sobre tu cuenta owner',
      [
        isApproved
          ? 'Ya puedes ingresar al panel owner y terminar la configuracion de tu complejo.'
          : `El estado actual de tu cuenta es <strong>${normalizedStatus}</strong>.`,
        note ? `Nota del administrador: ${note}` : '',
      ].filter(Boolean),
    ),
  });
}

export async function sendReservationPaidEmail({ reservation, user, court, complex }) {
  if (!user?.email || !reservation) return { sent: false, skipped: true, reason: 'missing_data' };

  return sendEmailSafe({
    to: user.email,
    subject: 'Reserva confirmada',
    text: `Tu reserva para ${court?.name || 'la cancha'} en ${complex?.name || 'el complejo'} fue confirmada para el ${formatDate(reservation.date)} a las ${reservation.startTime}.`,
    html: wrapEmail('Reserva confirmada', [
      `Tu reserva para <strong>${court?.name || 'la cancha'}</strong> ya quedo confirmada.`,
      `Complejo: <strong>${complex?.name || 'Clubes Tucuman'}</strong>.`,
      `Fecha: <strong>${formatDate(reservation.date)}</strong>.`,
      `Horario: <strong>${reservation.startTime} a ${reservation.endTime}</strong>.`,
      `Importe pagado: <strong>${formatMoney(reservation.totalPrice)}</strong>.`,
    ]),
  });
}

export async function sendReservationOwnerPaidEmail({ reservation, owner, user, court, complex }) {
  if (!owner?.email || !reservation) return { sent: false, skipped: true, reason: 'missing_data' };

  return sendEmailSafe({
    to: owner.email,
    subject: 'Recibiste un pago por reserva',
    text: `Se acredito una reserva en ${complex?.name || 'tu complejo'} por ${formatMoney(reservation.totalPrice)}.`,
    html: wrapEmail('Recibiste un pago por reserva', [
      `Se acredito una reserva en <strong>${complex?.name || 'tu complejo'}</strong>.`,
      `Cliente: <strong>${user?.displayName || user?.email || 'Cliente'}</strong>.`,
      `Cancha: <strong>${court?.name || 'Cancha'}</strong>.`,
      `Fecha: <strong>${formatDate(reservation.date)}</strong>.`,
      `Horario: <strong>${reservation.startTime} a ${reservation.endTime}</strong>.`,
      `Importe: <strong>${formatMoney(reservation.totalPrice)}</strong>.`,
    ]),
  });
}

export async function sendOrderPaidEmail({ order, user, complex }) {
  if (!user?.email || !order) return { sent: false, skipped: true, reason: 'missing_data' };

  const items = Array.isArray(order.items) ? order.items : [];
  const summary = items
    .map((item) => `${item.productId?.name || 'Producto'} x${Number(item.quantity || 1)}`)
    .join(', ');

  return sendEmailSafe({
    to: user.email,
    subject: 'Compra confirmada',
    text: `Tu compra en ${complex?.name || 'la tienda'} fue confirmada. Total: ${formatMoney(order.totalAmount)}.`,
    html: wrapEmail('Compra confirmada', [
      `Tu pedido en <strong>${complex?.name || 'la tienda del complejo'}</strong> ya quedo acreditado.`,
      summary ? `Productos: <strong>${summary}</strong>.` : '',
      `Total abonado: <strong>${formatMoney(order.totalAmount)}</strong>.`,
      `Fecha: <strong>${formatDate(order.paidAt || order.createdAt)}</strong>.`,
    ].filter(Boolean)),
  });
}

export async function sendOrderOwnerPaidEmail({ order, owner, user, complex }) {
  if (!owner?.email || !order) return { sent: false, skipped: true, reason: 'missing_data' };

  const items = Array.isArray(order.items) ? order.items : [];
  const summary = items
    .map((item) => `${item.productId?.name || 'Producto'} x${Number(item.quantity || 1)}`)
    .join(', ');

  return sendEmailSafe({
    to: owner.email,
    subject: 'Recibiste un pago en tu tienda',
    text: `Se acredito una compra en ${complex?.name || 'tu tienda'} por ${formatMoney(order.totalAmount)}.`,
    html: wrapEmail('Recibiste un pago en tu tienda', [
      `Se acredito un pedido en <strong>${complex?.name || 'tu tienda'}</strong>.`,
      `Cliente: <strong>${user?.displayName || user?.email || 'Cliente'}</strong>.`,
      summary ? `Detalle: <strong>${summary}</strong>.` : '',
      `Importe total: <strong>${formatMoney(order.totalAmount)}</strong>.`,
    ].filter(Boolean)),
  });
}

export async function sendOwnerBillingPaidEmail({ invoice, owner }) {
  if (!owner?.email || !invoice) return { sent: false, skipped: true, reason: 'missing_data' };

  return sendEmailSafe({
    to: owner.email,
    subject: 'Mensualidad acreditada',
    text: `Tu mensualidad fue acreditada correctamente. Acceso habilitado hasta ${formatDate(invoice.accessEndsAt)}.`,
    html: wrapEmail('Mensualidad acreditada', [
      'Tu pago mensual fue acreditado correctamente.',
      `Importe: <strong>${formatMoney(invoice.amount)}</strong>.`,
      `Acceso habilitado hasta: <strong>${formatDate(invoice.accessEndsAt)}</strong>.`,
    ]),
  });
}

export async function sendAdminOwnerBillingPaidEmail({ invoice, owner }) {
  return sendAdminNotification({
    subject: 'Se acredito una mensualidad owner',
    text: `Mensualidad acreditada de ${owner?.displayName || owner?.email || 'owner'} por ${formatMoney(invoice?.amount)}.`,
    html: wrapEmail('Se acredito una mensualidad owner', [
      `Owner: <strong>${owner?.displayName || owner?.email || 'Owner'}</strong>.`,
      `Importe: <strong>${formatMoney(invoice?.amount)}</strong>.`,
      `Acceso hasta: <strong>${formatDate(invoice?.accessEndsAt)}</strong>.`,
    ]),
  });
}
