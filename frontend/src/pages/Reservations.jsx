import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  Loader2,
  Plus,
  RotateCcw,
  User,
  X,
} from 'lucide-react';
import { fetchAPI } from '../services/api';
import { normalizeBookingHours } from '../utils/bookingHours';
const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const STATUS_STYLE = {
  CONFIRMED: { label: 'Confirmada', cls: 'bg-green-400/10 text-green-400 border-green-400/20' },
  PENDING: { label: 'Pendiente', cls: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-red-400/10 text-red-400 border-red-400/20' },
};

const PAYMENT_STYLE = {
  UNPAID: { label: 'Sin cobrar', cls: 'bg-red-400/10 text-red-400 border-red-400/20' },
  PARTIAL: { label: 'Parcial', cls: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' },
  PAID: { label: 'Pagada', cls: 'bg-green-400/10 text-green-400 border-green-400/20' },
  REFUNDED: { label: 'Reembolsada', cls: 'bg-sky-400/10 text-sky-400 border-sky-400/20' },
};

const INPUT_CLS =
  'w-full rounded-2xl border border-outline_variant/15 bg-surface_container px-4 py-3 text-sm text-on_surface placeholder:text-outline focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15';

export default function Reservations() {
  const [refDate, setRefDate] = useState(new Date());
  const [complex, setComplex] = useState(null);
  const [courts, setCourts] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noComplex, setNoComplex] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [form, setForm] = useState({ courtId: '', date: '', startTime: '' });
  const [saving, setSaving] = useState(false);
  const [reservationActionId, setReservationActionId] = useState('');
  const [takenHours, setTakenHours] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const selectedCourt = useMemo(
    () => courts.find((court) => court._id === form.courtId) || null,
    [courts, form.courtId],
  );
  const availableHours = useMemo(
    () => normalizeBookingHours(selectedCourt?.bookingHours),
    [selectedCourt],
  );

  useEffect(() => {
    fetchAPI('/complexes/mine')
      .then(async (ownedComplex) => {
        setComplex(ownedComplex);
        const [courtList, reservationList] = await Promise.all([
          fetchAPI(`/courts?complexId=${ownedComplex._id}`),
          fetchAPI(`/reservations?complexId=${ownedComplex._id}`),
        ]);
        setCourts(courtList);
        setReservations(reservationList);
      })
      .catch((error) => {
        if (error.status === 404) {
          setNoComplex(true);
          return;
        }
        alert(error.message || 'No se pudo cargar la informacion del calendario.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!form.courtId || !form.date) {
      setTakenHours([]);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);

    fetchAPI(`/reservations/taken?courtId=${form.courtId}&date=${form.date}`)
      .then((data) => {
        if (!cancelled) setTakenHours(data.takenHours || []);
      })
      .catch(() => {
        if (!cancelled) setTakenHours([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.courtId, form.date]);

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate]);
  const weekStart = weekDates[0].toISOString().split('T')[0];
  const weekEnd = weekDates[6].toISOString().split('T')[0];
  const todayKey = new Date().toISOString().split('T')[0];

  const weekReservations = useMemo(
    () =>
      reservations
        .filter((reservation) => {
          const date = new Date(reservation.date).toISOString().split('T')[0];
          return date >= weekStart && date <= weekEnd;
        })
        .sort((left, right) => {
          const leftDate = new Date(left.date).getTime();
          const rightDate = new Date(right.date).getTime();
          if (leftDate !== rightDate) return leftDate - rightDate;
          return left.startTime.localeCompare(right.startTime);
        }),
    [reservations, weekEnd, weekStart],
  );

  const stats = useMemo(() => {
    const pending = weekReservations.filter((reservation) => reservation.status === 'PENDING').length;
    const confirmed = weekReservations.filter((reservation) => reservation.status === 'CONFIRMED').length;
    const revenue = weekReservations
      .filter((reservation) => reservation.status === 'CONFIRMED')
      .reduce((sum, reservation) => sum + Number(reservation.totalPrice || 0), 0);
    return { total: weekReservations.length, pending, confirmed, revenue };
  }, [weekReservations]);

  const reservationsByDay = useMemo(
    () =>
      weekDates.map((date) => {
        const key = date.toISOString().split('T')[0];
        return {
          date,
          key,
          reservations: weekReservations.filter(
            (reservation) => new Date(reservation.date).toISOString().split('T')[0] === key,
          ),
        };
      }),
    [weekDates, weekReservations],
  );

  const refetchReservations = async () => {
    if (!complex) return;
    const reservationList = await fetchAPI(`/reservations?complexId=${complex._id}`);
    setReservations(reservationList);
  };

  const openCreateModal = () => {
    setForm({
      courtId: courts[0]?._id || '',
      date: new Date().toISOString().split('T')[0],
      startTime: '',
    });
    setTakenHours([]);
    setModalOpen(true);
  };

  const closeCreateModal = () => {
    setModalOpen(false);
    setSaving(false);
    setTakenHours([]);
    setForm({ courtId: '', date: '', startTime: '' });
  };

  const handleCreateReservation = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await fetchAPI('/reservations', { method: 'POST', body: JSON.stringify(form) });
      await refetchReservations();
      closeCreateModal();
    } catch (error) {
      alert(error.message || 'No se pudo crear la reserva.');
      setSaving(false);
    }
  };

  const handleConfirm = async (reservationId) => {
    setReservationActionId(reservationId);
    try {
      await fetchAPI(`/reservations/${reservationId}/confirm`, { method: 'PATCH' });
      await refetchReservations();
      setSelectedReservation(null);
    } catch (error) {
      alert(error.message || 'No se pudo confirmar la reserva.');
    } finally {
      setReservationActionId('');
    }
  };

  const handleCancel = async (reservationId) => {
    const shouldCancel = confirm('Se va a cancelar esta reserva. Quieres continuar?');
    if (!shouldCancel) return;

    setReservationActionId(reservationId);
    try {
      await fetchAPI(`/reservations/${reservationId}/cancel`, { method: 'PATCH' });
      await refetchReservations();
      setSelectedReservation(null);
    } catch (error) {
      alert(error.message || 'No se pudo cancelar la reserva.');
    } finally {
      setReservationActionId('');
    }
  };

  const handleRefund = async (reservationId) => {
    const shouldRefund = confirm('Se va a reembolsar el pago de esta reserva. Quieres continuar?');
    if (!shouldRefund) return;

    setReservationActionId(reservationId);
    try {
      await fetchAPI(`/reservations/${reservationId}/refund`, { method: 'POST' });
      await refetchReservations();
      setSelectedReservation(null);
    } catch (error) {
      alert(error.message || 'No se pudo reembolsar la reserva.');
    } finally {
      setReservationActionId('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (noComplex) {
    return <NoComplexBanner />;
  }

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-sm uppercase tracking-widest text-outline">
            {complex?.name || 'Mi complejo'}
          </p>
          <h2 className="text-[2rem] font-display font-medium tracking-tight text-on_surface sm:text-[2.5rem]">
            Calendario
          </h2>
          <p className="text-on_surface_variant">
            Sigue tu agenda semanal y gestiona reservas desde un solo lugar.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-6 py-3 font-semibold text-on_primary_fixed shadow-[0_8px_30px_-10px_rgba(47,172,76,0.42)] transition-all hover:scale-[1.01] hover:brightness-110 sm:w-auto"
        >
          <Plus size={20} />
          Nueva reserva
        </button>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reservas semana" value={stats.total} hint="entre lunes y domingo" />
        <StatCard label="Pendientes" value={stats.pending} hint="necesitan confirmacion" accent="warning" />
        <StatCard label="Confirmadas" value={stats.confirmed} hint="ya validadas" accent="success" />
        <StatCard label="Ingresos semana" value={`$${stats.revenue.toLocaleString('es-AR')}`} hint="solo reservas confirmadas" />
      </section>

      <section className="mb-6 rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftWeek(setRefDate, -7)}
              className="rounded-2xl bg-surface_container_high px-3 py-3 text-on_surface_variant transition-colors hover:text-on_surface"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => shiftWeek(setRefDate, 7)}
              className="rounded-2xl bg-surface_container_high px-3 py-3 text-on_surface_variant transition-colors hover:text-on_surface"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => setRefDate(new Date())}
              className="ml-1 rounded-2xl border border-outline_variant/15 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Hoy
            </button>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-on_surface">{formatWeekRange(weekDates)}</p>
            <p className="text-sm text-on_surface_variant">
              {courts.length} cancha{courts.length !== 1 ? 's' : ''} disponible{courts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </section>

      {courts.length === 0 ? (
        <EmptyReservationsState />
      ) : (
        <>
          <section className="space-y-4 lg:hidden">
            {reservationsByDay.map(({ date, key, reservations: dayReservations }) => (
              <DayAgendaCard
                key={key}
                date={date}
                isToday={key === todayKey}
                reservations={dayReservations}
                onSelect={setSelectedReservation}
              />
            ))}
          </section>

          <section className="hidden gap-4 lg:grid lg:grid-cols-2 2xl:grid-cols-4">
            {reservationsByDay.map(({ date, key, reservations: dayReservations }) => (
              <DayAgendaCard
                key={key}
                date={date}
                isToday={key === todayKey}
                reservations={dayReservations}
                onSelect={setSelectedReservation}
              />
            ))}
          </section>
        </>
      )}

      {modalOpen && (
        <Modal title="Nueva reserva" onClose={closeCreateModal}>
          <form onSubmit={handleCreateReservation} className="space-y-4">
            <Field label="Cancha">
              <select
                value={form.courtId}
                onChange={(event) => setForm((current) => ({ ...current, courtId: event.target.value }))}
                className={INPUT_CLS}
                required
              >
                <option value="">Selecciona una cancha</option>
                {courts.map((court) => (
                  <option key={court._id} value={court._id}>
                    {court.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Fecha">
                <input
                  type="date"
                  value={form.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className={INPUT_CLS}
                  required
                />
              </Field>

              <Field label="Horario">
                <select
                  value={form.startTime}
                  onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                  className={INPUT_CLS}
                  required
                >
                  <option value="">Selecciona un horario</option>
                  {availableHours.map((hour) => (
                    <option key={hour} value={hour} disabled={takenHours.includes(hour)}>
                      {hour}
                      {takenHours.includes(hour) ? ' - ocupado' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="rounded-2xl border border-outline_variant/10 bg-surface_container p-4 text-sm text-on_surface_variant">
              {slotsLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  Cargando horarios ocupados...
                </div>
              ) : availableHours.length === 0 ? (
                <p>Esta cancha no tiene horarios reservables configurados.</p>
              ) : takenHours.length > 0 ? (
                <p>Horarios ocupados: {takenHours.join(', ')}</p>
              ) : (
                <p>No hay choques para la fecha seleccionada.</p>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={closeCreateModal}
                className="flex-1 rounded-2xl border border-outline_variant/20 px-4 py-3 text-sm font-medium text-on_surface_variant transition-colors hover:bg-surface_container_highest"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-4 py-3 text-sm font-semibold text-on_primary_fixed transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {saving ? 'Guardando...' : 'Crear reserva'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedReservation && (
        <Modal title="Detalle de reserva" onClose={() => setSelectedReservation(null)}>
          <ReservationDetail
            reservation={selectedReservation}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onRefund={handleRefund}
            processing={reservationActionId === selectedReservation._id}
          />
        </Modal>
      )}
    </div>
  );
}

function DayAgendaCard({ date, isToday, reservations, onSelect }) {
  return (
    <article className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-outline">{DAYS[date.getDay()]}</p>
            {isToday && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                Hoy
              </span>
            )}
          </div>
          <h3 className="mt-2 text-xl font-display font-medium text-on_surface">
            {date.getDate()} {MONTHS[date.getMonth()]}
          </h3>
        </div>
        <span className="rounded-full bg-surface_container px-3 py-1 text-xs font-semibold text-on_surface_variant">
          {reservations.length} reserva{reservations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {reservations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline_variant/15 px-4 py-8 text-center text-sm text-on_surface_variant">
          No hay reservas para este dia.
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((reservation) => {
            const style = STATUS_STYLE[reservation.status] || STATUS_STYLE.PENDING;
            return (
              <button
                key={reservation._id}
                type="button"
                onClick={() => onSelect(reservation)}
                className="w-full rounded-2xl border border-outline_variant/10 bg-surface_container p-4 text-left transition-colors hover:bg-surface_container_highest"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on_surface">
                      {reservation.startTime} - {reservation.endTime}
                    </p>
                    <p className="mt-1 truncate text-sm text-on_surface_variant">
                      {reservation.court?.name || 'Cancha'}
                    </p>
                    <p className="mt-1 truncate text-xs text-outline">
                      {reservation.user?.displayName || reservation.user?.email || 'Cliente'}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${style.cls}`}>
                    {style.label}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-primary">
                  ${Number(reservation.totalPrice || 0).toLocaleString('es-AR')}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

function ReservationDetail({ reservation, onConfirm, onCancel, onRefund, processing = false }) {
  const style = STATUS_STYLE[reservation.status] || STATUS_STYLE.PENDING;
  const paymentMeta = PAYMENT_STYLE[reservation.paymentStatus] || PAYMENT_STYLE.UNPAID;
  const canRefund = reservation.paymentStatus === 'PAID' && Boolean(reservation.mercadoPagoOrderId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${style.cls}`}>
            {style.label}
          </span>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${paymentMeta.cls}`}>
            {paymentMeta.label}
          </span>
        </div>
        <span className="text-sm font-medium text-primary">${Number(reservation.totalPrice || 0).toLocaleString('es-AR')}</span>
      </div>

      <div className="space-y-3 rounded-[1.5rem] bg-surface_container p-4">
        <InfoRow icon={<CalendarRange size={15} />} label="Fecha" value={formatLongDate(reservation.date)} />
        <InfoRow icon={<Clock3 size={15} />} label="Horario" value={`${reservation.startTime} - ${reservation.endTime}`} />
        <InfoRow icon={<Building2 size={15} />} label="Cancha" value={reservation.court?.name || 'No disponible'} />
        <InfoRow icon={<User size={15} />} label="Cliente" value={reservation.user?.displayName || reservation.user?.email || 'No disponible'} />
        {reservation.user?.email && (
          <InfoRow icon={<User size={15} />} label="Email" value={reservation.user.email} />
        )}
        {reservation.user?.createdAt && (
          <InfoRow icon={<User size={15} />} label="Alta" value={new Date(reservation.user.createdAt).toLocaleDateString('es-AR')} />
        )}
        <InfoRow icon={<DollarSign size={15} />} label="Pago" value={paymentMeta.label} />
        {reservation.refundedAt && (
          <InfoRow icon={<RotateCcw size={15} />} label="Reembolso" value={formatDateTime(reservation.refundedAt)} />
        )}
      </div>

      {(reservation.status !== 'CANCELLED' || canRefund) && (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          {reservation.status === 'PENDING' && (
            <button
              type="button"
              onClick={() => onConfirm(reservation._id)}
              disabled={processing}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-green-400/20 bg-green-400/10 px-4 py-3 text-sm font-semibold text-green-400 transition-colors hover:bg-green-400/15"
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {processing ? 'Procesando...' : 'Confirmar'}
            </button>
          )}
          {canRefund && (
            <button
              type="button"
              onClick={() => onRefund(reservation._id)}
              disabled={processing}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-400 transition-colors hover:bg-sky-400/15 disabled:opacity-60"
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              {processing ? 'Procesando...' : 'Reembolsar'}
            </button>
          )}
          {reservation.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => onCancel(reservation._id)}
              disabled={processing}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-400/15 disabled:opacity-60"
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
              {processing ? 'Procesando...' : 'Cancelar'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, accent = 'default' }) {
  const accentCls =
    accent === 'warning' ? 'text-yellow-400' : accent === 'success' ? 'text-green-400' : 'text-primary';

  return (
    <article className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-outline">{label}</p>
      <h3 className={`mt-2 text-3xl font-display font-medium ${accentCls}`}>{value}</h3>
      <p className="mt-1 text-sm text-on_surface_variant">{hint}</p>
    </article>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-5 shrink-0 justify-center text-outline">{icon}</span>
      <span className="w-20 shrink-0 text-sm text-outline">{label}</span>
      <span className="text-sm font-medium text-on_surface">{value}</span>
    </div>
  );
}

function EmptyReservationsState() {
  return (
    <div className="rounded-[2rem] border border-dashed border-outline_variant/20 bg-surface_container_low px-6 py-12 text-center sm:px-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <CalendarRange size={28} />
      </div>
      <h3 className="text-2xl font-display font-medium text-on_surface">Todavia no tienes canchas activas</h3>
      <p className="mx-auto mt-3 max-w-xl text-on_surface_variant">
        El calendario se habilita cuando registras al menos una cancha dentro del complejo.
      </p>
      <Link
        to="/dashboard/courts"
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-6 py-3 font-semibold text-on_primary_fixed transition-all hover:brightness-110"
      >
        <Plus size={18} />
        Ir a canchas
      </Link>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-outline_variant/15 bg-surface_container_low p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3 className="text-xl font-display font-semibold text-on_surface">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-outline transition-colors hover:bg-surface_container hover:text-on_surface"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-outline">
        {label}
      </label>
      {children}
    </div>
  );
}

function NoComplexBanner() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-24 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Building2 size={28} className="text-primary" />
      </div>
      <h3 className="mb-2 text-2xl font-display font-medium text-on_surface">Configura tu complejo primero</h3>
      <p className="mb-6 text-sm text-on_surface_variant">
        Antes de ver el calendario necesitas registrar tu complejo con nombre y direccion.
      </p>
      <Link
        to="/dashboard/settings"
        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-8 py-3.5 font-semibold text-on_primary_fixed transition-all hover:brightness-110"
      >
        <Building2 size={16} />
        Configurar complejo
      </Link>
    </div>
  );
}

function getWeekDates(referenceDate) {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, index) => {
    const nextDate = new Date(monday);
    nextDate.setDate(monday.getDate() + index);
    return nextDate;
  });
}

function shiftWeek(setter, amount) {
  setter((current) => {
    const nextDate = new Date(current);
    nextDate.setDate(nextDate.getDate() + amount);
    return nextDate;
  });
}

function formatWeekRange(weekDates) {
  const start = weekDates[0];
  const end = weekDates[6];
  return `${start.getDate()} ${MONTHS[start.getMonth()]} - ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

function formatLongDate(value) {
  return new Date(value).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
