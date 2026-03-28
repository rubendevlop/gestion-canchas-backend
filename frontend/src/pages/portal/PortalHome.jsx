import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAPI } from '../../services/api';
import { MapPin, Star, ChevronRight, Search, Loader2 } from 'lucide-react';

export default function PortalHome() {
  const [complexes, setComplexes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAPI('/complexes?clientVisible=true')
      .then((data) => setComplexes(data))
      .catch(() => setComplexes([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = complexes.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <section className="relative mb-10 overflow-hidden rounded-[2rem] border border-outline_variant/20 bg-[linear-gradient(145deg,#ffffff,#eff7e5)] px-6 py-16 text-center shadow-[0_26px_70px_-42px_rgba(24,36,24,0.22)] sm:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(123,207,82,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(242,177,52,0.12),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full opacity-35 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_94px,rgba(123,207,82,0.08)_94px,rgba(123,207,82,0.08)_188px)]" />

        <div className="relative mx-auto max-w-3xl">
          <h1 className="mb-4 text-5xl font-display font-bold leading-tight text-on_surface">
            Reserva tu cancha
            <br />
            <span className="text-primary">en minutos.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-lg text-on_surface_variant">
            Encontra un complejo, elegi tu horario y entra a jugar con una interfaz mas viva y mas de club.
          </p>
          <div className="relative mx-auto max-w-lg">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-outline" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar complejo o ciudad..."
              className="w-full rounded-2xl border border-outline_variant/25 bg-white py-4 pl-14 pr-6 text-base text-on_surface placeholder-outline transition-all focus:border-primary/50 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={36} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-on_surface_variant/60">
          <p className="text-xl">No se encontraron complejos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((complex) => (
            <ComplexCard key={complex._id} complex={complex} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComplexCard({ complex }) {
  return (
    <Link
      to={`/portal/complejo/${complex._id}`}
      className="group block overflow-hidden rounded-3xl border border-outline_variant/20 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:bg-surface_container_low"
    >
      <div className="flex h-48 items-center justify-center bg-gradient-to-br from-primary/20 via-primary_container/20 to-secondary/15">
        {complex.imageUrl ? (
          <img src={complex.imageUrl} alt={complex.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl">Futbol</span>
        )}
      </div>

      <div className="p-5">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="text-lg font-display font-semibold leading-tight text-on_surface">{complex.name}</h3>
          <div className="ml-2 flex shrink-0 items-center gap-1 text-sm text-yellow-400">
            <Star size={13} fill="currentColor" />
            <span>4.8</span>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-1.5 text-sm text-on_surface_variant">
          <MapPin size={13} />
          <span className="truncate">{complex.address || 'Buenos Aires'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="rounded-full bg-surface_container px-3 py-1 text-xs text-on_surface_variant">
            {complex.courtsCount ?? '-'} canchas
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-primary transition-all group-hover:gap-2">
            Ver horarios <ChevronRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}
