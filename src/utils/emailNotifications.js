import { sendEmailSafe } from './mailer.js';

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
