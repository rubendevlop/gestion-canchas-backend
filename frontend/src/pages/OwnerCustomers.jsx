import { useEffect, useMemo, useState } from 'react';
import { fetchAPI } from '../services/api';
import {
  CalendarRange,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';

const RESERVATION_STATUS_STYLE = {
  CONFIRMED: { label: 'Confirmada', cls: 'bg-green-400/10 text-green-400 border border-green-400/20' },
  PENDING: { label: 'Pendiente', cls: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-red-400/10 text-red-400 border border-red-400/20' },
};

const PAYMENT_STATUS_STYLE = {
  UNPAID: { label: 'Sin cobrar', cls: 'bg-red-400/10 text-red-400 border border-red-400/20' },
  PARTIAL: { label: 'Parcial', cls: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' },
  PAID: { label: 'Pagada', cls: 'bg-green-400/10 text-green-400 border border-green-400/20' },
};

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(value) {
  if (typeof value !== 'number') return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function OwnerCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reservationFilter, setReservationFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  const loadCustomers = async () => {
    setLoading(true);

    try {
      const data = await fetchAPI('/users/directory');
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const stats = useMemo(() => ({
    totalCustomers: customers.length,
    reservations: customers.reduce((sum, customer) => sum + Number(customer.metrics?.reservations?.total || 0), 0),
    confirmed: customers.reduce((sum, customer) => sum + Number(customer.metrics?.reservations?.confirmed || 0), 0),
    pending: customers.reduce((sum, customer) => sum + Number(customer.metrics?.reservations?.pending || 0), 0),
  }), [customers]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return customers.filter((customer) => {
      if (reservationFilter !== 'ALL' && customer.latestReservation?.status !== reservationFilter) {
        return false;
      }

      if (paymentFilter !== 'ALL' && customer.latestReservation?.paymentStatus !== paymentFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        customer.displayName,
        customer.email,
        customer.latestReservation?.court?.name,
        customer.latestReservation?.status,
        customer.latestReservation?.paymentStatus,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });
  }, [customers, paymentFilter, reservationFilter, search]);

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-8 lg:mb-10">
        <h2 className="text-[2rem] sm:text-[2.5rem] font-display font-medium text-on_surface tracking-tight mb-1">
          Clientes del complejo
        </h2>
        <p className="text-on_surface_variant">
          Solo ves usuarios que hicieron reservas en tus canchas.
        </p>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Clientes" value={stats.totalCustomers} icon={User} />
        <MetricCard label="Reservas" value={stats.reservations} icon={CalendarRange} />
        <MetricCard label="Confirmadas" value={stats.confirmed} icon={Clock3} accent="text-green-400" />
        <MetricCard label="Pendientes" value={stats.pending} icon={Clock3} accent="text-yellow-400" />
      </div>

      <section className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_high overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-outline_variant/10 grid grid-cols-1 xl:grid-cols-[1fr_220px_220px_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
            <input
              type="text"
              placeholder="Buscar cliente, email o cancha..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-surface_container border border-outline_variant/15 rounded-xl py-2.5 pl-9 pr-4 text-sm text-on_surface placeholder-outline focus:outline-none focus:border-primary/40 transition-all"
            />
          </div>

          <select
            value={reservationFilter}
            onChange={(event) => setReservationFilter(event.target.value)}
            className="bg-surface_container border border-outline_variant/15 rounded-xl py-2.5 px-4 text-sm text-on_surface focus:outline-none focus:border-primary/40 transition-all"
          >
            <option value="ALL">Todas las reservas</option>
            <option value="CONFIRMED">Confirmadas</option>
            <option value="PENDING">Pendientes</option>
            <option value="CANCELLED">Canceladas</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="bg-surface_container border border-outline_variant/15 rounded-xl py-2.5 px-4 text-sm text-on_surface focus:outline-none focus:border-primary/40 transition-all"
          >
            <option value="ALL">Todo pago</option>
            <option value="UNPAID">Sin cobrar</option>
            <option value="PARTIAL">Parcial</option>
            <option value="PAID">Pagada</option>
          </select>

          <button
            type="button"
            onClick={loadCustomers}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface_container border border-outline_variant/15 px-4 py-2.5 text-sm text-on_surface_variant hover:bg-surface_container_highest transition-colors"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="animate-spin text-primary" size={34} />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="px-6 py-12 text-center text-on_surface_variant">
            No hay clientes que coincidan con esos filtros.
          </div>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredCustomers.map((customer) => {
              const reservationMeta =
                RESERVATION_STATUS_STYLE[customer.latestReservation?.status] || RESERVATION_STATUS_STYLE.PENDING;
              const paymentMeta =
                PAYMENT_STATUS_STYLE[customer.latestReservation?.paymentStatus] || PAYMENT_STATUS_STYLE.UNPAID;

              return (
                <article key={customer._id} className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        {customer.photoURL ? (
                          <img src={customer.photoURL} alt="" className="w-11 h-11 rounded-2xl shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-2xl bg-surface_container_highest flex items-center justify-center text-primary text-sm font-bold shrink-0">
                            {customer.displayName?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-on_surface truncate">{customer.displayName}</p>
                          <p className="text-sm text-outline break-all">{customer.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${reservationMeta.cls}`}>
                          {reservationMeta.label}
                        </span>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${paymentMeta.cls}`}>
                          {paymentMeta.label}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm text-on_surface_variant text-right">
                      <p>Alta: {formatDate(customer.createdAt)}</p>
                      <p>Ultima actividad: {formatDate(customer.metrics?.lastActivityAt)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
                    <MiniStat label="Reservas" value={customer.metrics?.reservations?.total || 0} />
                    <MiniStat label="Confirmadas" value={customer.metrics?.reservations?.confirmed || 0} />
                    <MiniStat label="Pendientes" value={customer.metrics?.reservations?.pending || 0} />
                    <MiniStat label="Importe" value={formatMoney(customer.metrics?.reservations?.amount || 0)} />
                  </div>

                  <div className="mt-5 rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-4">
                    <h4 className="text-sm font-semibold text-on_surface mb-3">Ultima reserva en tu complejo</h4>
                    <div className="space-y-3">
                      <InfoRow label="Cancha" value={customer.latestReservation?.court?.name || 'No disponible'} />
                      <InfoRow label="Fecha" value={formatDate(customer.latestReservation?.date)} />
                      <InfoRow label="Horario" value={customer.latestReservation ? `${customer.latestReservation.startTime} - ${customer.latestReservation.endTime}` : 'No disponible'} />
                      <InfoRow label="Importe" value={formatMoney(Number(customer.latestReservation?.totalPrice || 0))} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, accent = 'text-primary' }) {
  return (
    <div className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-5">
      <Icon size={18} className={`${accent} mb-2 opacity-70`} />
      <p className="text-xs text-outline uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-2xl font-display font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-surface_container px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-widest text-outline mb-1">{label}</p>
      <p className="text-sm text-on_surface">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-outline">{label}</span>
      <span className="text-sm font-medium text-on_surface text-right">{value}</span>
    </div>
  );
}
