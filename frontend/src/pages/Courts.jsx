import { Plus, View } from "lucide-react";

export default function Courts() {
  const courts = [
    { id: 1, name: "Cancha Principal - Pista A", type: "Fútbol 7", price: "20,000", status: "Activa" },
    { id: 2, name: "Indoor Célula 1", type: "Fútbol 5", price: "12,000", status: "Mantenimiento" },
    { id: 3, name: "Pádel Premium Azul", type: "Pádel", price: "8,500", status: "Activa" },
  ];

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-[2.5rem] font-display font-medium text-on_surface tracking-tight mb-1">
            Gestión de Canchas
          </h2>
          <p className="text-on_surface_variant text-lg">
            Administra los espacios, configura precios y estados de mantenimiento.
          </p>
        </div>
        
        <button className="bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold px-6 py-3 rounded-2xl flex items-center gap-2 shadow-[0_8px_30px_-10px_rgba(23,101,242,0.5)] hover:brightness-110 hover:scale-[1.02] transition-all">
          <Plus size={20} />
          Nueva Cancha
        </button>
      </header>

      {/* Grid Asimétrica de Canchas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {courts.map((c) => (
          <div key={c.id} className="bg-surface_container_low border border-outline_variant/10 rounded-[2rem] p-8 relative overflow-hidden group hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] transition-all duration-300">
             
             {/* Glow effect on hover */}
             <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 blur-[60px] rounded-full group-hover:bg-primary/20 transition-all"></div>

             <div className="relative z-10 flex flex-col h-full">
               <div className="flex justify-between items-start mb-12">
                 <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${c.status === 'Activa' ? 'bg-tertiary_fixed_dim/20 text-tertiary_fixed_dim' : 'bg-secondary_container/30 text-secondary'}`}>
                   {c.status}
                 </div>
                 <button className="text-outline_variant hover:text-primary transition-colors">
                   <View size={20} />
                 </button>
               </div>

               <div>
                 <p className="text-primary text-sm font-semibold mb-1">{c.type}</p>
                 <h3 className="text-2xl font-display font-medium text-on_surface mb-2 leading-tight">{c.name}</h3>
                 <p className="text-on_surface_variant text-sm mt-6">Precio base / hora</p>
                 <p className="text-3xl font-display font-bold text-on_surface mt-1">${c.price}</p>
               </div>
             </div>
          </div>
        ))}

        {/* Empty State / Adder Card */}
        <div className="bg-transparent border-2 border-dashed border-outline_variant/20 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 h-[340px]">
           <div className="w-16 h-16 bg-surface_container_highest rounded-full flex items-center justify-center text-primary mb-4">
             <Plus size={24} />
           </div>
           <h3 className="text-lg font-display font-medium text-on_surface mb-1">Añadir Espacio</h3>
           <p className="text-on_surface_variant text-sm max-w-xs">Registra una nueva cancha, pista o salón para habilitar nuevas reservas.</p>
        </div>
      </div>
    </div>
  );
}
