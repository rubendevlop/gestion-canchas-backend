import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarRange, ChevronRight, Clock, Loader2, MapPin, ShoppingBag, Star } from 'lucide-react';
import { fetchAPI } from '../../services/api';

export default function ComplexDetail() {
  const { complexId } = useParams();
  const [complex, setComplex] = useState(null);
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    Promise.all([
      fetchAPI(`/complexes/${complexId}?clientVisible=true`),
      fetchAPI(`/courts?complexId=${complexId}&clientVisible=true`),
    ])
      .then(([complexData, courtsData]) => {
        setComplex(complexData);
        setCourts(courtsData);
      })
      .catch((error) => {
        setErrorMessage(error.message || 'Este complejo no esta disponible temporalmente.');
      })
      .finally(() => setLoading(false));
  }, [complexId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  if (!complex) {
    return <div className="py-20 text-center text-white/40">{errorMessage || 'Complejo no encontrado.'}</div>;
  }

  return (
    <div>
      <div className="relative mb-8 flex h-64 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 to-primary_container/30">
        {complex.imageUrl ? (
          <img src={complex.imageUrl} alt={complex.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-8xl">Futbol</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 p-8">
          <h1 className="mb-2 text-4xl font-display font-bold text-white">{complex.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {complex.address || 'Buenos Aires'}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {complex.openTime || '08:00'} - {complex.closeTime || '23:00'}
            </span>
            <span className="flex items-center gap-1.5 text-yellow-400">
              <Star size={14} fill="currentColor" />
              4.8
            </span>
          </div>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4">
        <Link
          to={`/portal/complejo/${complexId}/reservar`}
          className="flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-primary_container to-primary py-5 text-lg font-semibold text-on_primary_fixed shadow-[0_8px_30px_-10px_rgba(23,101,242,0.5)] transition-all hover:scale-[1.01] hover:brightness-110"
        >
          <CalendarRange size={22} />
          Reservar cancha
        </Link>
        <Link
          to={`/portal/complejo/${complexId}/tienda`}
          className="flex items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/5 py-5 text-lg font-semibold text-white transition-all hover:bg-white/10"
        >
          <ShoppingBag size={22} />
          Ver tienda
        </Link>
      </div>

      <section>
        <h2 className="mb-5 text-2xl font-display font-semibold text-white">Canchas disponibles</h2>
        <div className="space-y-4">
          {courts.map((court) => {
            const imageUrl = court.imageUrl || court.image || court.images?.[0] || '';

            return (
              <Link
                key={court._id}
                to={`/portal/complejo/${complexId}/reservar?courtId=${court._id}`}
                className="group grid overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-primary/30 hover:bg-white/10 md:grid-cols-[220px_minmax(0,1fr)]"
              >
                <div className="h-44 bg-gradient-to-br from-white/5 to-white/10 md:h-full">
                  {imageUrl ? (
                    <img src={imageUrl} alt={court.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl text-white/20">Cancha</div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-6 px-6 py-5">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-white">{court.name}</p>
                    <p className="mt-1 text-sm text-white/40">{court.sport || 'Futbol 5'}</p>
                    {court.description && (
                      <p className="mt-3 text-sm text-white/55">{court.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-semibold text-primary">
                        ${court.pricePerHour?.toLocaleString('es-AR')}
                        <span className="text-xs font-normal text-white/30">/hr</span>
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          court.isAvailable !== false
                            ? 'bg-green-400/10 text-green-400'
                            : 'bg-red-400/10 text-red-400'
                        }`}
                      >
                        {court.isAvailable !== false ? 'Disponible' : 'No disponible'}
                      </span>
                    </div>
                    <ChevronRight size={18} className="text-white/20 transition-colors group-hover:text-primary" />
                  </div>
                </div>
              </Link>
            );
          })}

          {courts.length === 0 && (
            <p className="py-10 text-center text-white/30">Este complejo no tiene canchas cargadas aun.</p>
          )}
        </div>
      </section>
    </div>
  );
}
