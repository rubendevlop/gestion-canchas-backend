import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Users,
} from 'lucide-react';
import { fetchAPI } from '../services/api';

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SuperadminDashboard() {
  const [users, setUsers] = useState([]);
  const [complexes, setComplexes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [usersData, complexesData] = await Promise.all([
          fetchAPI('/users'),
          fetchAPI('/complexes'),
        ]);

        if (!active) return;

        setUsers(Array.isArray(usersData) ? usersData : []);
        setComplexes(
          Array.isArray(complexesData)
            ? [...complexesData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            : []
        );
      } catch (error) {
        if (!active) return;
        setUsers([]);
        setComplexes([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const pendingOwners = users.filter((user) => user.role === 'owner' && user.ownerStatus === 'PENDING');
    const approvedOwners = users.filter((user) => user.role === 'owner' && user.ownerStatus === 'APPROVED');
    const activeComplexes = complexes.filter((complex) => complex.isActive);

    return {
      pendingOwners,
      approvedOwners,
      activeComplexes,
    };
  }, [complexes, users]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-8 sm:mb-10 flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <p className="text-sm text-outline uppercase tracking-widest mb-1">Superadmin</p>
          <h2 className="text-[2rem] sm:text-[2.5rem] font-display font-medium text-on_surface tracking-tight">
            Panel global
          </h2>
          <p className="text-on_surface_variant">
            Desde aca validas owners y monitoreas el estado general de los complejos.
          </p>
        </div>
        <Link
          to="/dashboard/users"
          className="w-full sm:w-auto justify-center bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold px-6 py-3 rounded-2xl flex items-center gap-2 shadow-[0_8px_30px_-10px_rgba(23,101,242,0.5)] hover:brightness-110 hover:scale-[1.02] transition-all"
        >
          Revisar validaciones <ArrowRight size={18} />
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={Clock}
          label="Owners pendientes"
          value={metrics.pendingOwners.length}
          color="text-yellow-400"
          accent={metrics.pendingOwners.length > 0}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Owners aprobados"
          value={metrics.approvedOwners.length}
          color="text-green-400"
        />
        <MetricCard
          icon={Building2}
          label="Complejos activos"
          value={metrics.activeComplexes.length}
          color="text-primary"
        />
        <MetricCard
          icon={Users}
          label="Usuarios totales"
          value={users.length}
          color="text-on_surface"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8">
        <section className="bg-surface_container_high rounded-[1.75rem] border border-outline_variant/10 p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-display font-medium text-on_surface">Solicitudes owner</h3>
              <p className="text-sm text-on_surface_variant">
                Las cuentas pendientes deben aprobarse antes de que puedan usar el dashboard.
              </p>
            </div>
            <Link to="/dashboard/users" className="text-sm text-primary hover:text-primary_fixed transition-colors">
              Ver panel
            </Link>
          </div>

          {metrics.pendingOwners.length === 0 ? (
            <div className="bg-green-400/5 border border-green-400/15 rounded-3xl p-8 text-center">
              <CheckCircle2 size={34} className="text-green-400 mx-auto mb-3" />
              <p className="text-on_surface font-medium">No hay owners pendientes.</p>
              <p className="text-sm text-on_surface_variant mt-2">
                El flujo de aprobacion esta al dia.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.pendingOwners.slice(0, 5).map((user) => (
                <div
                  key={user._id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-yellow-400/15 bg-yellow-400/5 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-on_surface font-medium truncate">{user.displayName}</p>
                    <p className="text-sm text-outline truncate">{user.email}</p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs uppercase tracking-wider text-yellow-400">Pendiente</p>
                    <p className="text-xs text-outline">{formatDate(user.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="bg-surface_container rounded-[1.75rem] border border-outline_variant/10 p-5 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-display font-medium text-on_surface">Complejos recientes</h3>
                <p className="text-sm text-on_surface_variant">Ultimos registros creados en la plataforma.</p>
              </div>
              <Link to="/dashboard/complexes" className="text-sm text-primary hover:text-primary_fixed transition-colors">
                Gestionar
              </Link>
            </div>

            {complexes.length === 0 ? (
              <div className="rounded-2xl bg-surface_container_low px-5 py-6 text-sm text-on_surface_variant">
                Todavia no hay complejos registrados.
              </div>
            ) : (
              <div className="space-y-3">
                {complexes.slice(0, 4).map((complex) => (
                  <div key={complex._id} className="rounded-2xl bg-surface_container_low px-5 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-on_surface font-medium truncate">{complex.name}</p>
                        <p className="text-sm text-outline truncate">
                          {complex.ownerId?.displayName || complex.ownerId?.email || 'Sin owner'}
                        </p>
                      </div>
                      <span
                        className={`text-[0.65rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full shrink-0 ${
                          complex.isActive
                            ? 'bg-green-400/10 text-green-400'
                            : 'bg-red-400/10 text-red-400'
                        }`}
                      >
                        {complex.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-outline mt-3">
                      <MapPin size={13} />
                      <span className="truncate">{complex.address || 'Sin direccion'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface_container rounded-[1.75rem] border border-outline_variant/10 p-5 sm:p-7">
            <h3 className="text-xl font-display font-medium text-on_surface mb-5">Estado general</h3>
            <div className="space-y-4">
              <SummaryRow label="Complejos activos" value={`${metrics.activeComplexes.length} / ${complexes.length || 0}`} />
              <SummaryRow label="Owners aprobados" value={metrics.approvedOwners.length} />
              <SummaryRow label="Solicitudes pendientes" value={metrics.pendingOwners.length} highlight={metrics.pendingOwners.length > 0} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, accent = false }) {
  return (
    <div
      className={`bg-surface_container border rounded-[1.5rem] p-5 ${
        accent ? 'border-yellow-400/30 bg-yellow-400/5' : 'border-outline_variant/10'
      }`}
    >
      <Icon size={18} className={`${color} mb-2 opacity-70`} />
      <p className="text-xs text-outline uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-2xl font-display font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, highlight = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-on_surface_variant">{label}</span>
      <span className={`font-display font-semibold ${highlight ? 'text-yellow-400' : 'text-on_surface'}`}>
        {value}
      </span>
    </div>
  );
}
