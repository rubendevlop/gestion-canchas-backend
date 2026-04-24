import { sendEmailSafe } from './mailer.js';

function normalizeString(value = '') {
  return String(value || '').trim();
}

function escapeHtml(value = '') {
  return normalizeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function strong(value = '') {
  return `<strong>${escapeHtml(value)}</strong>`;
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

function formatTimeRange(startTime = '', endTime = '') {
  const start = normalizeString(startTime);
  const end = normalizeString(endTime);

  if (start && end) {
    return `${start} a ${end}`;
  }

  return start || end || '-';
}

function getDisplayName(user) {
  return normalizeString(user?.displayName || user?.email || 'Usuario');
}

function getComplexName(complex) {
  return normalizeString(complex?.name || 'Clubes Tucuman');
}

function getCourtName(court) {
  return normalizeString(court?.name || 'Cancha');
}

function getPaymentMethodLabel(value = '') {
  return normalizeString(value).toUpperCase() === 'ONLINE' ? 'Pago online' : 'Pago en cancha';
}

function getReservationStateLabel(reservation = {}) {
  if (String(reservation?.status || '').toUpperCase() === 'CANCELLED') {
    return 'Cancelada';
  }

  if (String(reservation?.paymentStatus || '').toUpperCase() === 'PAID') {
    return 'Confirmada y pagada';
  }

  if (normalizeString(reservation?.paymentMethod).toUpperCase() === 'ONLINE') {
    return 'Pendiente de pago online';
  }

  if (String(reservation?.status || '').toUpperCase() === 'CONFIRMED') {
    return 'Confirmada';
  }

  return 'Pendiente de confirmacion';
}

function getOrderStateLabel(order = {}) {
  const status = normalizeString(order?.status).toLowerCase();

  if (status === 'completed') return 'Completado';
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'failed') return 'Fallido';

  if (normalizeString(order?.paymentMethod).toUpperCase() === 'ONLINE') {
    return 'Pendiente de pago online';
  }

  return 'Pendiente de retiro y cobro';
}

function getActorLabel(actor = {}) {
  const displayName = getDisplayName(actor);
  if (displayName && displayName !== 'Usuario') {
    return displayName;
  }

  const role = normalizeString(actor?.role).toLowerCase();
  if (role === 'owner') return 'el complejo';
  if (role === 'superadmin') return 'administracion';
  if (role === 'client') return 'el cliente';
  return 'el sistema';
}

function getOrderItemsSummary(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const productName = normalizeString(item?.productId?.name || 'Producto');
      const quantity = Math.max(1, Number(item?.quantity || 1));
      return `${productName} x${quantity}`;
    })
    .join(', ');
}

function wrapEmail(title, bodyLines = []) {
  const body = bodyLines.map((line) => `<p style="margin:0 0 12px;">${line}</p>`).join('');

  return `
    <div style="font-family:Arial,sans-serif;background:#f4f7ef;padding:32px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #e3ead8;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5b6f58;">Clubes Tucuman</p>
        <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;color:#1f2c1f;">${escapeHtml(title)}</h1>
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

export async function sendAdminUserRegistrationEmail(user) {
  const displayName = getDisplayName(user);
  const role = normalizeString(user?.role || 'client').toLowerCase();

  return sendAdminNotification({
    subject: `Nuevo registro ${role === 'owner' ? 'owner' : 'de cliente'}`,
    text: `Nuevo registro: ${displayName} (${user?.email || 'sin email'}) - rol ${role}.`,
    html: wrapEmail('Nuevo registro en Clubes Tucuman', [
      `Se registro ${strong(displayName)} con rol ${strong(role || 'client')}.`,
      `Email: ${strong(user?.email || '-')}.`,
      `Telefono: ${strong(user?.phone || '-')}.`,
    ]),
  });
}

export async function sendWelcomeEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };

  const displayName = getDisplayName(user);
  return sendEmailSafe({
    to: user.email,
    subject: 'Bienvenido a Clubes Tucuman',
    text: `Hola ${displayName}, tu cuenta ya esta lista para usar Clubes Tucuman.`,
    html: wrapEmail('Bienvenido a Clubes Tucuman', [
      `Hola ${strong(displayName)}.`,
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
      `Tu solicitud para operar ${strong(application.complexName || 'tu complejo')} fue recibida correctamente.`,
      'Nuestro equipo la revisara y te avisaremos por correo cuando quede aprobada.',
      `Ciudad declarada: ${strong(application.city || '-')}.`,
      `Contacto: ${strong(application.contactPhone || user.phone || user.email || '-')}.`,
    ]),
  });
}

export async function sendAdminOwnerApplicationEmail(user) {
  const application = user?.ownerApplication || {};
  const displayName = getDisplayName(user);

  return sendAdminNotification({
    subject: 'Nueva solicitud de owner',
    text: `Nueva solicitud owner: ${displayName} - ${application.complexName || 'Sin complejo'}.`,
    html: wrapEmail('Nueva solicitud de owner', [
      `Se registro una nueva solicitud owner de ${strong(displayName)}.`,
      `Complejo: ${strong(application.complexName || '-')}.`,
      `Documento: ${strong(`${application.documentType || '-'} ${application.documentNumber || ''}`.trim())}.`,
      `Telefono: ${strong(application.contactPhone || '-')}.`,
      `Ciudad: ${strong(application.city || '-')}.`,
      `Canchas declaradas: ${strong(application.courtsCount || 0)}.`,
    ]),
  });
}

export async function sendOwnerStatusEmail(user, status, note = '') {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };

  const normalizedStatus = normalizeString(status).toUpperCase();
  const isApproved = normalizedStatus === 'APPROVED';

  return sendEmailSafe({
    to: user.email,
    subject: isApproved ? 'Tu cuenta owner fue aprobada' : 'Actualizacion sobre tu cuenta owner',
    text: isApproved
      ? 'Tu cuenta owner fue aprobada y ya puedes continuar con la configuracion del complejo.'
      : `Tu cuenta owner fue marcada como ${normalizedStatus}. ${normalizeString(note)}`.trim(),
    html: wrapEmail(
      isApproved ? 'Tu cuenta owner fue aprobada' : 'Actualizacion sobre tu cuenta owner',
      [
        isApproved
          ? 'Ya puedes ingresar al panel owner y terminar la configuracion de tu complejo.'
          : `El estado actual de tu cuenta es ${strong(normalizedStatus || 'PENDING')}.`,
        note ? `Nota del administrador: ${strong(note)}.` : '',
      ].filter(Boolean),
    ),
  });
}

export async function sendReservationCreatedEmail({ reservation, user, court, complex }) {
  if (!reservation || !user?.email) {
    return { sent: false, skipped: true, reason: 'missing_data' };
  }

  const complexName = getComplexName(complex);
  const courtName = getCourtName(court);
  const schedule = `${formatDate(reservation.date)} - ${formatTimeRange(reservation.startTime, reservation.endTime)}`;

  return sendEmailSafe({
    to: user.email,
    subject: 'Reserva registrada',
    text: `Tu reserva en ${complexName} para ${courtName} fue registrada para ${schedule}. Estado: ${getReservationStateLabel(reservation)}.`,
    html: wrapEmail('Reserva registrada', [
      `Registramos tu reserva para ${strong(courtName)} en ${strong(complexName)}.`,
      `Fecha y horario: ${strong(schedule)}.`,
      `Metodo de pago: ${strong(getPaymentMethodLabel(reservation.paymentMethod))}.`,
      `Estado actual: ${strong(getReservationStateLabel(reservation))}.`,
      `Importe: ${strong(formatMoney(reservation.totalPrice))}.`,
    ]),
  });
}

export async function sendReservationOwnerCreatedEmail({ reservation, owner, user, court, complex }) {
  if (!reservation || !owner?.email) {
    return { sent: false, skipped: true, reason: 'missing_data' };
  }

  const complexName = getComplexName(complex);
  const courtName = getCourtName(court);
  const schedule = `${formatDate(reservation.date)} - ${formatTimeRange(reservation.startTime, reservation.endTime)}`;
  const clientName = getDisplayName(user);

  return sendEmailSafe({
    to: owner.email,
    subject: 'Nueva reserva en tu complejo',
    text: `Se registro una reserva de ${clientName} para ${courtName} en ${complexName}. Estado: ${getReservationStateLabel(reservation)}.`,
    html: wrapEmail('Nueva reserva en tu complejo', [
      `Se registro una nueva reserva en ${strong(complexName)}.`,
      `Cliente: ${strong(clientName)}.`,
      `Cancha: ${strong(courtName)}.`,
      `Fecha y horario: ${strong(schedule)}.`,
      `Metodo de pago: ${strong(getPaymentMethodLabel(reservation.paymentMethod))}.`,
      `Estado actual: ${strong(getReservationStateLabel(reservation))}.`,
    ]),
  });
}

export async function sendReservationConfirmedEmail({ reservation, user, court, complex }) {
  if (!reservation || !user?.email) {
    return { sent: false, skipped: true, reason: 'missing_data' };
  }

  const complexName = getComplexName(complex);
  const courtName = getCourtName(court);
  const schedule = `${formatDate(reservation.date)} - ${formatTimeRange(reservation.startTime, reservation.endTime)}`;

  return sendEmailSafe({
    to: user.email,
    subject: 'Tu reserva fue confirmada',
    text: `Tu reserva en ${complexName} para ${courtName} fue confirmada para ${schedule}.`,
    html: wrapEmail('Tu reserva fue confirmada', [
      `El complejo confirmo tu reserva para ${strong(courtName)}.`,
      `Complejo: ${strong(complexName)}.`,
      `Fecha y horario: ${strong(schedule)}.`,
      `Metodo de pago: ${strong(getPaymentMethodLabel(reservation.paymentMethod))}.`,
    ]),
  });
}

export async function sendReservationCancelledEmail({
  reservation,
  user,
  court,
  complex,
  cancelledBy,
}) {
  if (!reservation || !user?.email) {
    return { sent: false, skipped: true, reason: 'missing_data' };
  }

  const complexName = getComplexName(complex);
  const courtName = getCourtName(court);
  const schedule = `${formatDate(reservation.date)} - ${formatTimeRange(reservation.startTime, reservation.endTime)}`;

  return sendEmailSafe({
    to: user.email,
    subject: 'Tu reserva fue cancelada',
    text: `La reserva en ${complexName} para ${courtName} fue cancelada por ${getActorLabel(cancelledBy)}.`,
    html: wrapEmail('Tu reserva fue cancelada', [
      `La reserva para ${strong(courtName)} en ${strong(complexName)} fue cancelada.`,
      `Fecha y horario: ${strong(schedule)}.`,
      `Cancelada por: ${strong(getActorLabel(cancelledBy))}.`,
    ]),
  });
}

export async function sendReservationOwnerCancelledEmail({
  reservation,
  owner,
  user,
  court,
  complex,
  cancelledBy,
}) {
  if (!reservation || !owner?.email) {
    return { sent: false, skipped: true, reason: 'missing_data' };
  }

  const complexName = getComplexName(complex);
  const courtName = getCourtName(court);
  const schedule = `${formatDate(reservation.date)} - ${formatTimeRange(reservation.startTime, reservation.endTime)}`;

  return sendEmailSafe({
    to: owner.email,
    subject: 'Se cancelo una reserva',
    text: `La reserva de ${getDisplayName(user)} para ${courtName} en ${complexName} fue cancelada por ${getActorLabel(cancelledBy)}.`,
    html: wrapEmail('Se cancelo una reserva', [
      `Se cancelo una reserva en ${strong(complexName)}.`,
      `Cliente: ${strong(getDisplayName(user))}.`,
      `Cancha: ${strong(courtName)}.`,
      `Fecha y horario: ${strong(schedule)}.`,
      `Cancelada por: ${strong(getActorLabel(cancelledBy))}.`,
    ]),
  });
}

export async function sendReservationPaidEmail({ reservation, user, court, complex }) {
  if (!user?.email || !reservation) return { sent: false, skipped: true, reason: 'missing_data' };

  return sendEmailSafe({
    to: user.email,
    subject: 'Reserva confirmada',
    text: `Tu reserva para ${getCourtName(court)} en ${getComplexName(complex)} fue confirmada para el ${formatDate(reservation.date)} a las ${reservation.startTime}.`,
    html: wrapEmail('Reserva confirmada', [
      `Tu reserva para ${strong(getCourtName(court))} ya quedo confirmada.`,
      `Complejo: ${strong(getComplexName(complex))}.`,
      `Fecha: ${strong(formatDate(reservation.date))}.`,
      `Horario: ${strong(formatTimeRange(reservation.startTime, reservation.endTime))}.`,
      `Importe pagado: ${strong(formatMoney(reservation.totalPrice))}.`,
    ]),
  });
}

export async function sendReservationOwnerPaidEmail({ reservation, owner, user, court, complex }) {
  if (!owner?.email || !reservation) return { sent: false, skipped: true, reason: 'missing_data' };

  return sendEmailSafe({
    to: owner.email,
    subject: 'Recibiste un pago por reserva',
    text: `Se acredito una reserva en ${getComplexName(complex)} por ${formatMoney(reservation.totalPrice)}.`,
    html: wrapEmail('Recibiste un pago por reserva', [
      `Se acredito una reserva en ${strong(getComplexName(complex))}.`,
      `Cliente: ${strong(getDisplayName(user))}.`,
      `Cancha: ${strong(getCourtName(court))}.`,
      `Fecha: ${strong(formatDate(reservation.date))}.`,
      `Horario: ${strong(formatTimeRange(reservation.startTime, reservation.endTime))}.`,
      `Importe: ${strong(formatMoney(reservation.totalPrice))}.`,
    ]),
  });
}

export async function sendOrderCreatedEmail({ order, user, complex }) {
  if (!order || !user?.email) return { sent: false, skipped: true, reason: 'missing_data' };

  const complexName = getComplexName(complex);
  const itemSummary = getOrderItemsSummary(order.items);

  return sendEmailSafe({
    to: user.email,
    subject: 'Pedido recibido',
    text: `Tu pedido en ${complexName} fue recibido. Estado: ${getOrderStateLabel(order)}. Total: ${formatMoney(order.totalAmount)}.`,
    html: wrapEmail('Pedido recibido', [
      `Recibimos tu pedido en ${strong(complexName)}.`,
      itemSummary ? `Productos: ${strong(itemSummary)}.` : '',
      `Metodo de pago: ${strong(getPaymentMethodLabel(order.paymentMethod))}.`,
      `Estado actual: ${strong(getOrderStateLabel(order))}.`,
      `Total: ${strong(formatMoney(order.totalAmount))}.`,
    ].filter(Boolean)),
  });
}

export async function sendOrderOwnerCreatedEmail({ order, owner, user, complex }) {
  if (!order || !owner?.email) return { sent: false, skipped: true, reason: 'missing_data' };

  const complexName = getComplexName(complex);
  const itemSummary = getOrderItemsSummary(order.items);

  return sendEmailSafe({
    to: owner.email,
    subject: 'Nuevo pedido en tu tienda',
    text: `Se registro un pedido de ${getDisplayName(user)} en ${complexName}. Estado: ${getOrderStateLabel(order)}.`,
    html: wrapEmail('Nuevo pedido en tu tienda', [
      `Se registro un nuevo pedido en ${strong(complexName)}.`,
      `Cliente: ${strong(getDisplayName(user))}.`,
      itemSummary ? `Detalle: ${strong(itemSummary)}.` : '',
      `Metodo de pago: ${strong(getPaymentMethodLabel(order.paymentMethod))}.`,
      `Estado actual: ${strong(getOrderStateLabel(order))}.`,
      `Total: ${strong(formatMoney(order.totalAmount))}.`,
    ].filter(Boolean)),
  });
}

export async function sendOrderCancelledEmail({ order, user, complex, cancelledBy }) {
  if (!order || !user?.email) return { sent: false, skipped: true, reason: 'missing_data' };

  return sendEmailSafe({
    to: user.email,
    subject: 'Tu pedido fue cancelado',
    text: `El pedido en ${getComplexName(complex)} fue cancelado por ${getActorLabel(cancelledBy)}.`,
    html: wrapEmail('Tu pedido fue cancelado', [
      `Se cancelo tu pedido en ${strong(getComplexName(complex))}.`,
      `Cancelado por: ${strong(getActorLabel(cancelledBy))}.`,
      `Total: ${strong(formatMoney(order.totalAmount))}.`,
    ]),
  });
}

export async function sendOrderOwnerCancelledEmail({ order, owner, user, complex, cancelledBy }) {
  if (!order || !owner?.email) return { sent: false, skipped: true, reason: 'missing_data' };

  return sendEmailSafe({
    to: owner.email,
    subject: 'Se cancelo un pedido',
    text: `El pedido de ${getDisplayName(user)} en ${getComplexName(complex)} fue cancelado por ${getActorLabel(cancelledBy)}.`,
    html: wrapEmail('Se cancelo un pedido', [
      `Se cancelo un pedido en ${strong(getComplexName(complex))}.`,
      `Cliente: ${strong(getDisplayName(user))}.`,
      `Cancelado por: ${strong(getActorLabel(cancelledBy))}.`,
      `Total: ${strong(formatMoney(order.totalAmount))}.`,
    ]),
  });
}

export async function sendOrderPaidEmail({ order, user, complex }) {
  if (!user?.email || !order) return { sent: false, skipped: true, reason: 'missing_data' };

  const summary = getOrderItemsSummary(order.items);

  return sendEmailSafe({
    to: user.email,
    subject: 'Compra confirmada',
    text: `Tu compra en ${getComplexName(complex)} fue confirmada. Total: ${formatMoney(order.totalAmount)}.`,
    html: wrapEmail('Compra confirmada', [
      `Tu pedido en ${strong(getComplexName(complex))} ya quedo acreditado.`,
      summary ? `Productos: ${strong(summary)}.` : '',
      `Total abonado: ${strong(formatMoney(order.totalAmount))}.`,
      `Fecha: ${strong(formatDate(order.paidAt || order.createdAt))}.`,
    ].filter(Boolean)),
  });
}

export async function sendOrderOwnerPaidEmail({ order, owner, user, complex }) {
  if (!owner?.email || !order) return { sent: false, skipped: true, reason: 'missing_data' };

  const summary = getOrderItemsSummary(order.items);

  return sendEmailSafe({
    to: owner.email,
    subject: 'Recibiste un pago en tu tienda',
    text: `Se acredito una compra en ${getComplexName(complex)} por ${formatMoney(order.totalAmount)}.`,
    html: wrapEmail('Recibiste un pago en tu tienda', [
      `Se acredito un pedido en ${strong(getComplexName(complex))}.`,
      `Cliente: ${strong(getDisplayName(user))}.`,
      summary ? `Detalle: ${strong(summary)}.` : '',
      `Importe total: ${strong(formatMoney(order.totalAmount))}.`,
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
      `Importe: ${strong(formatMoney(invoice.amount))}.`,
      `Acceso habilitado hasta: ${strong(formatDate(invoice.accessEndsAt))}.`,
    ]),
  });
}

export async function sendAdminOwnerBillingPaidEmail({ invoice, owner }) {
  return sendAdminNotification({
    subject: 'Se acredito una mensualidad owner',
    text: `Mensualidad acreditada de ${getDisplayName(owner)} por ${formatMoney(invoice?.amount)}.`,
    html: wrapEmail('Se acredito una mensualidad owner', [
      `Owner: ${strong(getDisplayName(owner))}.`,
      `Importe: ${strong(formatMoney(invoice?.amount))}.`,
      `Acceso hasta: ${strong(formatDate(invoice?.accessEndsAt))}.`,
    ]),
  });
}
