import { useState, useEffect } from 'react';
import { fetchAPI } from '../../services/api';
import { CalendarRange, Clock, MapPin, XCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  confirmed: { label: 'Confirmada', cls: 'bg-green-400/10 text-green-400' },
  pending:   { label: 'Pendiente',  cls: 'bg-yellow-400/10 text-yellow-400' },
  cancelled: { label: 'Cancelada',  cls: 'bg-red-400/10 text-red-400' },
};

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
    if (!confirm('¿Cancelar esta reserva?')) return;
    try {
      await fetchAPI(`/reservations/${id}/cancel`, { method: 'PATCH' });
      setReservations((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: 'cancelled' } : r))
      );
    } catch (err) {
      alert(err.message || 'Error al cancelar.');
    }
  };

  const upcoming = reservations.filter((r) => new Date(`${r.date}T${r.startTime}`) >= new Date() && r.status !== 'cancelled');
  const past     = reservations.filter((r) => new Date(`${r.date}T${r.startTime}`) < new Date() || r.status === 'cancelled');

  return (
    <div>
      <h1 className="text-3xl font-display font-bold text-white mb-8">Mis Reservas</h1>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={36}/></div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-24">
          <CalendarRange size={56} className="mx-auto text-white/20 mb-4" strokeWidth={1}/>
          <p className="text-white/40 mb-6">Todavía no tenés reservas.</p>
          <Link to="/portal" className="bg-primary/20 text-primary hover:bg-primary/30 px-6 py-3 rounded-2xl text-sm font-semibold transition-all">
            Buscar un complejo
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white/60 mb-4 uppercase tracking-wider text-sm">Próximas</h2>
              <div className="space-y-3">
                {upcoming.map((r) => <ReservationCard key={r._id} r={r} onCancel={handleCancel}/>)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white/60 mb-4 uppercase tracking-wider text-sm">Historial</h2>
              <div className="space-y-3 opacity-60">
                {past.map((r) => <ReservationCard key={r._id} r={r}/>)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ReservationCard({ r, onCancel }) {
  const s = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
  const canCancel = r.status !== 'cancelled' && new Date(`${r.date}T${r.startTime}`) > new Date();

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-5">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
          <CalendarRange size={22}/>
        </div>
        <div>
          <p className="font-semibold text-white">{r.court?.name || 'Cancha'}</p>
          <p className="text-white/40 text-sm flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1"><MapPin size={12}/>{r.complex?.name || r.court?.complexId}</span>
            <span className="flex items-center gap-1"><Clock size={12}/>{r.date} · {r.startTime}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${s.cls}`}>{s.label}</span>
        {canCancel && onCancel && (
          <button onClick={() => onCancel(r._id)} className="text-white/20 hover:text-error transition-colors" title="Cancelar">
            <XCircle size={18}/>
          </button>
        )}
      </div>
    </div>
  );
}
