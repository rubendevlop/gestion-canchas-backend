import { CalendarRange } from "lucide-react";

export default function Reservations() {
  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-[2.5rem] font-display font-medium text-on_surface tracking-tight mb-1">
            Calendario de Reservas
          </h2>
          <p className="text-on_surface_variant text-lg">
            Vista integral de ocupación de canchas.
          </p>
        </div>
      </header>

      <div className="bg-surface_container_low rounded-[2rem] p-8 min-h-[600px] flex flex-col items-center justify-center text-center border border-outline_variant/10 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.2)]">
         <CalendarRange size={64} className="text-outline_variant/40 mb-6" strokeWidth={1} />
         <h3 className="text-2xl font-display font-medium text-on_surface mb-2">Calendario Interactivo</h3>
         <p className="text-on_surface_variant max-w-md mx-auto mb-8">
           El grid de turnos y franjas horarias está listo para inyectar datos del backend. Aquí verás una matriz visual de todas tus canchas día por día.
         </p>
         <button className="bg-surface_container_highest text-on_surface font-medium px-6 py-3 rounded-2xl hover:bg-surface_variant transition-all">
            Simular Configuración de Grid
         </button>
      </div>
    </div>
  );
}
