import { useState, useEffect } from 'react';
import { fetchAPI } from '../../services/api';
import { CalendarRange, Clock, MapPin, XCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  confirmed: { label: 'Confirmada', cls: 'bg-green-400/10 text-green-500' },
  pending: { label: 'Pendiente', cls: 'bg-yellow-400/10 text-yellow-600' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-400/10 text-red-500' },
};

const PAYMENT_STYLES = {
  PAID: { label: 'Pagada', cls: 'bg-green-400/10 text-green-500' },
  PARTIAL: { label: 'Pago parcial', cls: 'bg-yellow-400/10 text-yellow-600' },
  UNPAID: { label: 'Sin pagar', cls: 'bg-red-400/10 text-red-500' },
  REFUNDED: { label: 'Reembolsada', cls: 'bg-sky-400/10 text-sky-500' },
};

function getReservationDateTime(reservation) {
  const rawDate = String(reservation?.date || '');
  const dateOnly = rawDate.includes('T') ? rawDate.slice(0, 10) : rawDate;
  const parsed = new Date(`${dateOnly}T${reservation?.startTime || '00:00'}`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatReservationDate(value) {
  const rawDate = String(value || '');
  const dateOnly = rawDate.includes('T') ? rawDate.slice(0, 10) : rawDate;
  const parsed = new Date(`${dateOnly}T00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value || '-';
  }

  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function MyReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI('/reservations/mine')
      .then(setReservations)
      .catch(() => setReservations([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async (id) => {
    if (!confirm('Cancelar esta reserva?')) return;
    try {
      await fetchAPI(`/reservations/${id}/cancel`, { method: 'PATCH' });
      setReservations((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: 'cancelled' } : r)),
      );
    } catch (err) {
      alert(err.message || 'Error al cancelar.');
    }
  };

  const upcoming = reservations.filter((r) => {
    const reservationDateTime = getReservationDateTime(r);
    return reservationDateTime && reservationDateTime >= new Date() && r.status !== 'cancelled';
  });

  const past = reservations.filter((r) => {
    const reservationDateTime = getReservationDateTime(r);
    return !reservationDateTime || reservationDateTime < new Date() || r.status === 'cancelled';
  });

  return (
    <div>
      <h1 className="mb-8 font-display text-3xl font-bold text-on_surface">Mis reservas</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={36} />
        </div>
      ) : reservations.length === 0 ? (
        <div className="py-24 text-center">
          <CalendarRange size={56} className="mx-auto mb-4 text-on_surface_variant/25" strokeWidth={1} />
          <p className="mb-6 text-on_surface_variant">Todavia no tienes reservas.</p>
          <Link
            to="/portal"
            className="rounded-2xl bg-primary/10 px-6 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/15"
          >
            Buscar un complejo
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-on_surface_variant">
                Proximas
              </h2>
              <div className="space-y-3">
                {upcoming.map((r) => (
                  <ReservationCard key={r._id} r={r} onCancel={handleCancel} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-on_surface_variant">
                Historial
              </h2>
              <div className="space-y-3 opacity-75">
                {past.map((r) => (
                  <ReservationCard key={r._id} r={r} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ReservationCard({ r, onCancel }) {
  const normalizedStatus = String(r.status || '').toLowerCase();
  const s = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.pending;
  const payment = PAYMENT_STYLES[String(r.paymentStatus || '').toUpperCase()] || PAYMENT_STYLES.UNPAID;
  const reservationDateTime = getReservationDateTime(r);
  const canCancel = normalizedStatus !== 'cancelled' && reservationDateTime && reservationDateTime > new Date();

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-outline_variant/20 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarRange size={22} />
        </div>
        <div>
          <p className="font-semibold text-on_surface">{r.court?.name || 'Cancha'}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-3 text-sm text-on_surface_variant">
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {r.complex?.name || r.court?.complexId || 'Complejo'}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatReservationDate(r.date)} - {r.startTime}
            </span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${payment.cls}`}>{payment.label}</span>
        {canCancel && onCancel && (
          <button onClick={() => onCancel(r._id)} className="text-outline transition-colors hover:text-error" title="Cancelar">
            <XCircle size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
