import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Loader2,
  MapPin,
  Phone,
  Power,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import { fetchAPI } from '../services/api';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'inactive', label: 'Inactivos' },
];

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminComplexes() {
  const [complexes, setComplexes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [togglingId, setTogglingId] = useState(null);

  const loadComplexes = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await fetchAPI('/complexes');
      setComplexes(
        Array.isArray(data)
          ? [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          : []
      );
    } catch (error) {
      setComplexes([]);
    } finally {
      if (showLoader) setLoading(false);
      else setRefreshing(false);
    }
  };

  useEffect(() => {
    loadComplexes();
  }, []);

  const filteredComplexes = useMemo(() => {
    return complexes.filter((complex) => {
      const matchSearch =
        !search ||
        complex.name?.toLowerCase().includes(search.toLowerCase()) ||
        complex.address?.toLowerCase().includes(search.toLowerCase()) ||
        complex.ownerId?.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        complex.ownerId?.email?.toLowerCase().includes(search.toLowerCase());

      const matchFilter =
        filter === 'all' ||
        (filter === 'active' && complex.isActive) ||
        (filter === 'inactive' && !complex.isActive);

      return matchSearch && matchFilter;
    });
  }, [complexes, filter, search]);

  const stats = useMemo(() => {
    const activeCount = complexes.filter((complex) => complex.isActive).length;
    return {
      total: complexes.length,
      active: activeCount,
      inactive: complexes.length - activeCount,
    };
  }, [complexes]);

  const handleToggle = async (complex) => {
    setTogglingId(complex._id);
    try {
      const updated = await fetchAPI(`/complexes/${complex._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !complex.isActive }),
      });

      setComplexes((prev) =>
        prev.map((item) => (item._id === complex._id ? { ...item, isActive: updated.isActive } : item))
      );
    } catch (error) {
      alert(error.message || 'No se pudo actualizar el complejo.');
    } finally {
      setTogglingId(null);
    }
  };

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
          <h2 className="text-[2rem] sm:text-[2.5rem] font-display font-medium text-on_surface tracking-tight">
            Complejos
          </h2>
          <p className="text-on_surface_variant">
            Vista global de complejos registrados y su disponibilidad dentro de la plataforma.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadComplexes(false)}
          className="w-full md:w-auto justify-center flex items-center gap-2 px-4 py-3 rounded-2xl bg-surface_container border border-outline_variant/10 text-on_surface_variant hover:text-primary hover:bg-surface_container_highest transition-colors"
        >
          {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Actualizar
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total" value={stats.total} color="text-on_surface" />
        <StatCard label="Activos" value={stats.active} color="text-green-400" />
        <StatCard label="Inactivos" value={stats.inactive} color="text-red-400" />
      </div>

      <div className="bg-surface_container_high rounded-[1.75rem] border border-outline_variant/10 overflow-hidden">
        <div className="px-4 sm:px-6 py-5 border-b border-outline_variant/10 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={16} />
            <input
              type="text"
              placeholder="Buscar complejo, owner o direccion..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-surface_container border border-outline_variant/15 rounded-xl py-3 pl-11 pr-4 text-sm text-on_surface placeholder-outline focus:outline-none focus:border-primary/40 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === item.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-surface_container text-on_surface_variant border border-outline_variant/10 hover:text-on_surface'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filteredComplexes.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <Building2 size={44} className="text-outline_variant/40 mx-auto mb-3" />
            <p className="text-on_surface_variant">No hay complejos que coincidan con el filtro actual.</p>
          </div>
        ) : (
          <div className="divide-y divide-outline_variant/10">
            {filteredComplexes.map((complex) => (
              <div key={complex._id} className="px-4 sm:px-6 py-5 flex flex-col xl:flex-row gap-5 xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h3 className="text-lg font-display font-medium text-on_surface">{complex.name}</h3>
                    <span
                      className={`text-[0.65rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                        complex.isActive
                          ? 'bg-green-400/10 text-green-400'
                          : 'bg-red-400/10 text-red-400'
                      }`}
                    >
                      {complex.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <InfoLine icon={UserRound} text={complex.ownerId?.displayName || complex.ownerId?.email || 'Owner sin datos'} subtext={complex.ownerId?.email} />
                    <InfoLine icon={MapPin} text={complex.address || 'Sin direccion cargada'} />
                    <InfoLine icon={Phone} text={complex.phone || 'Sin telefono'} />
                    <InfoLine icon={Building2} text={`Creado ${formatDate(complex.createdAt)}`} />
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {togglingId === complex._id ? (
                    <div className="flex items-center gap-2 text-sm text-outline">
                      <Loader2 size={16} className="animate-spin" />
                      Actualizando...
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggle(complex)}
                      className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
                        complex.isActive
                          ? 'bg-red-400/10 text-red-400 hover:bg-red-400/20'
                          : 'bg-green-400/10 text-green-400 hover:bg-green-400/20'
                      }`}
                    >
                      <Power size={16} />
                      {complex.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-surface_container border border-outline_variant/10 rounded-[1.5rem] p-5">
      <p className="text-xs text-outline uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-display font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function InfoLine({ icon: Icon, text, subtext }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="w-8 h-8 rounded-xl bg-surface_container flex items-center justify-center text-outline shrink-0">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-on_surface_variant truncate">{text}</p>
        {subtext && <p className="text-xs text-outline truncate mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}
