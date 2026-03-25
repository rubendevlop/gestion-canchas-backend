import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  ChevronRight,
  DollarSign,
  LayoutGrid,
  Loader2,
  Plus,
} from 'lucide-react';
import { fetchAPI } from '../services/api';

const STATUS_STYLE = {
  CONFIRMED: { label: 'Confirmada', cls: 'text-green-400 bg-green-400/10' },
  PENDING: { label: 'Pendiente', cls: 'text-yellow-400 bg-yellow-400/10' },
  CANCELLED: { label: 'Cancelada', cls: 'text-red-400 bg-red-400/10' },
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchAPI('/dashboard/stats')
      .then(setStats)
      .catch((error) => {
        if (error.status === 404) {
          setStats({ hasComplex: false });
          return;
        }

        setStats(null);
        setErrorMessage(error.message || 'No se pudo cargar el dashboard.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!stats?.hasComplex) {
    if (errorMessage) {
      return <ErrorState message={errorMessage} />;
    }
    return <NoComplexState />;
  }

  const { today, courts, month, lowStock, complex } = stats;

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-8 sm:mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-outline uppercase tracking-widest mb-1">{complex.name}</p>
          <h2 className="text-[2rem] sm:text-[2.5rem] font-display font-medium text-on_surface tracking-tight">
            Panel de Control
          </h2>
          <p className="text-on_surface_variant">
            {today.count === 0
              ? 'Sin reservas por el momento hoy.'
              : `Hoy tenes ${today.count} reserva${today.count !== 1 ? 's' : ''} activa${today.count !== 1 ? 's' : ''}.`}
          </p>
        </div>

        <Link
          to="/dashboard/reservations"
          className="w-full sm:w-auto justify-center bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold px-6 py-3 rounded-2xl flex items-center gap-2 shadow-[0_8px_30px_-10px_rgba(23,101,242,0.5)] hover:brightness-110 hover:scale-[1.02] transition-all"
        >
          <Plus size={20} /> Nueva Reserva
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-6 mb-10">
        <div className="sm:col-span-2 xl:col-span-5 bg-surface_container border border-outline_variant/10 rounded-[1.5rem] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full group-hover:bg-primary/20 transition-all" />
          <div>
            <p className="text-sm font-semibold tracking-[0.05em] uppercase text-outline mb-2 flex items-center gap-2">
              <DollarSign size={14} /> Ingresos Confirmados (Hoy)
            </p>
            <h3 className="text-4xl sm:text-5xl font-display font-bold text-on_surface">
              ${today.income.toLocaleString('es-AR')}
            </h3>
          </div>
          <div className="mt-6 flex items-center gap-2 text-on_surface_variant text-sm">
            <span>
              {today.confirmedCount} reserva{today.confirmedCount !== 1 ? 's' : ''} confirmada{today.confirmedCount !== 1 ? 's' : ''} hoy
            </span>
          </div>
        </div>

        <div className="xl:col-span-4 bg-surface_container border border-outline_variant/10 rounded-[1.5rem] p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.05em] uppercase text-outline mb-2 flex items-center gap-2">
              <LayoutGrid size={14} /> Canchas ({courts.total} total)
            </p>
            <h3 className="text-3xl sm:text-4xl font-display font-medium text-on_surface">
              {courts.occupied} ocupada{courts.occupied !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-xs text-outline mb-2">
              <span>Ocupacion</span>
              <span>{courts.occupancyRate}%</span>
            </div>
            <div className="w-full bg-surface_container_highest h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full shadow-[0_0_10px_rgba(179,197,255,0.8)] transition-all"
                style={{ width: `${courts.occupancyRate}%` }}
              />
            </div>
            <p className="text-xs text-outline mt-2 text-right">
              {courts.available} disponible{courts.available !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="xl:col-span-3 bg-surface_container border border-outline_variant/10 rounded-[1.5rem] p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.05em] uppercase text-error mb-2 flex items-center gap-2">
              <AlertTriangle size={14} /> Stock Critico
            </p>
            <h3 className="text-3xl sm:text-4xl font-display font-medium text-on_surface">
              {lowStock.length} item{lowStock.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <Link
            to="/dashboard/products"
            className="flex items-center gap-2 text-sm text-primary hover:text-primary_fixed transition-colors font-medium mt-auto"
          >
            Ver Inventario <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface_container_high rounded-[1.5rem] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-display font-medium text-on_surface">Reservas de Hoy</h3>
            <Link to="/dashboard/reservations" className="text-sm text-primary hover:text-primary_fixed transition-colors">
              Ver todo
            </Link>
          </div>

          {today.reservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
              <CalendarRange size={40} strokeWidth={1} className="text-outline_variant mb-3" />
              <p className="text-on_surface_variant text-sm">No hay reservas hoy.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {today.reservations.map((reservation) => {
                const status = STATUS_STYLE[reservation.status] || STATUS_STYLE.PENDING;

                return (
                  <div
                    key={reservation._id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-surface_container_highest -mx-4 px-4 py-3 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-surface_container_low rounded-2xl flex items-center justify-center font-bold text-on_surface text-sm shrink-0">
                        {reservation.startTime}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-on_surface text-sm">{reservation.court?.name || 'Cancha'}</p>
                        <p className="text-xs text-outline truncate">
                          {reservation.user?.displayName || reservation.user?.email || 'Cliente'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-left sm:text-right">
                      <div>
                        <p className="font-semibold text-primary text-sm">
                          ${reservation.totalPrice?.toLocaleString('es-AR')}
                        </p>
                        <span className={`text-[0.65rem] font-bold uppercase px-2 py-0.5 rounded-full ${status.cls}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-surface_container rounded-[1.5rem] p-6 sm:p-8">
          <h3 className="text-xl font-display font-medium text-on_surface mb-6">Estado del Complejo</h3>

          <div className="space-y-4">
            <StatRow label="Reservas este mes" value={month.totalReservations} />
            <StatRow label="Canchas activas" value={`${courts.available} / ${courts.total}`} />

            {lowStock.length > 0 && (
              <div className="mt-4 pt-4 border-t border-outline_variant/10">
                <p className="text-xs uppercase tracking-wider text-error mb-3 font-semibold flex items-center gap-2">
                  <AlertTriangle size={12} /> Productos con stock bajo
                </p>
                <div className="space-y-2">
                  {lowStock.map((product) => (
                    <div key={product._id} className="flex justify-between items-center gap-4 text-sm">
                      <span className="text-on_surface_variant truncate">{product.name}</span>
                      <span className="text-error font-semibold shrink-0">{product.stock} u.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <AlertTriangle size={72} className="text-red-400/60 mb-6" strokeWidth={1} />
      <h2 className="text-2xl sm:text-3xl font-display font-medium text-on_surface mb-3">
        No se pudo cargar el dashboard
      </h2>
      <p className="text-on_surface_variant max-w-md mb-8">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="w-full sm:w-auto bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold px-8 py-4 rounded-2xl hover:brightness-110 transition-all"
      >
        Reintentar
      </button>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-on_surface_variant text-sm">{label}</span>
      <span className="font-display font-semibold text-on_surface shrink-0">{value}</span>
    </div>
  );
}

function NoComplexState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Building2 size={72} className="text-outline_variant/30 mb-6" strokeWidth={1} />
      <h2 className="text-2xl sm:text-3xl font-display font-medium text-on_surface mb-3">
        Aun no tenes un complejo configurado
      </h2>
      <p className="text-on_surface_variant max-w-md mb-8">
        Para ver metricas, reservas e ingresos, primero tenes que crear tu complejo deportivo.
      </p>
      <Link
        to="/dashboard/settings"
        className="w-full sm:w-auto bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold px-8 py-4 rounded-2xl hover:brightness-110 transition-all"
      >
        Crear mi complejo
      </Link>
    </div>
  );
}
