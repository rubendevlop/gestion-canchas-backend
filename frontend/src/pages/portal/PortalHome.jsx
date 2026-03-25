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
      {/* Hero */}
      <section className="text-center py-16 mb-10">
        <h1 className="text-5xl font-display font-bold text-white mb-4 leading-tight">
          Reservá tu cancha<br />
          <span className="text-primary">en minutos.</span>
        </h1>
        <p className="text-white/50 text-lg mb-8 max-w-md mx-auto">
          Encontrá el complejo más cercano, elegí tu horario y listo.
        </p>
        <div className="relative max-w-lg mx-auto">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar complejo o ciudad..."
            className="w-full bg-white/5 border border-white/15 rounded-2xl py-4 pl-14 pr-6 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 text-base transition-all"
          />
        </div>
      </section>

      {/* Grid de complejos */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={36} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <p className="text-xl">No se encontraron complejos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
      className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 rounded-3xl overflow-hidden transition-all duration-300 block"
    >
      {/* Image placeholder */}
      <div className="h-48 bg-gradient-to-br from-primary/20 to-primary_container/30 flex items-center justify-center">
        {complex.imageUrl ? (
          <img src={complex.imageUrl} alt={complex.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl">⚽</span>
        )}
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-display font-semibold text-white text-lg leading-tight">{complex.name}</h3>
          <div className="flex items-center gap-1 text-yellow-400 text-sm shrink-0 ml-2">
            <Star size={13} fill="currentColor" />
            <span>4.8</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-white/40 text-sm mb-4">
          <MapPin size={13} />
          <span className="truncate">{complex.address || 'Buenos Aires'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-white/30 bg-white/5 px-3 py-1 rounded-full">
            {complex.courtsCount ?? '—'} canchas
          </span>
          <span className="flex items-center gap-1 text-primary text-sm font-medium group-hover:gap-2 transition-all">
            Ver horarios <ChevronRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}
