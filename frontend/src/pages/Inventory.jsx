import { Search, Plus, MoreHorizontal, Filter, PackageOpen } from "lucide-react";

export default function Inventory() {
  const products = [
    { id: 1, name: "Smartwatch Pro 4", qty: 42, price: 199.00, status: "Normal" },
    { id: 2, name: "Headphones Ultra", qty: 18, price: 89.50, status: "Bajo" },
    { id: 3, name: "Classic Wristwatch", qty: 12, price: 120.00, status: "Crítico" },
    { id: 4, name: "Bebida Isotónica 500ml", qty: 140, price: 3.50, status: "Normal" },
    { id: 5, name: "Pelota de Fútbol N°5", qty: 5, price: 45.00, status: "Crítico" },
  ];

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-[2.5rem] font-display font-medium text-on_surface tracking-tight mb-1">
            Inventario Detallado
          </h2>
          <p className="text-on_surface_variant text-lg">
            Control de productos físicos y artículos de venta del complejo.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button className="bg-surface_container_highest text-on_surface font-medium px-5 py-3 rounded-2xl flex items-center gap-2 hover:bg-surface_variant transition-all">
            <Filter size={20} /> Filtrar
          </button>
          <button className="bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold px-6 py-3 rounded-2xl flex items-center gap-2 shadow-[0_8px_30px_-10px_rgba(23,101,242,0.5)] hover:brightness-110 hover:scale-[1.02] transition-all">
            <Plus size={20} />
            Añadir Producto
          </button>
        </div>
      </header>

      {/* Controles y Buscador */}
      <div className="bg-surface_container_low rounded-[2rem] p-8 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.2)]">
        
        <div className="flex justify-between items-center mb-10">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline_variant" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, código o categoría..." 
              className="w-full bg-surface_container border border-outline_variant/10 rounded-2xl py-3.5 pl-12 pr-6 text-on_surface placeholder-outline focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-surface_container_highest transition-all"
            />
          </div>
        </div>

        {/* Lista de Inventario Strict "No-Line" Manifesto */}
        <div className="space-y-6">
           {/* Cabecera Editorial Implícita */}
           <div className="grid grid-cols-12 gap-4 px-6 mb-2">
              <div className="col-span-5 text-xs font-semibold tracking-widest text-outline uppercase">Producto</div>
              <div className="col-span-2 text-xs font-semibold tracking-widest text-outline uppercase">Stock</div>
              <div className="col-span-2 text-xs font-semibold tracking-widest text-outline uppercase">Precio</div>
              <div className="col-span-2 text-xs font-semibold tracking-widest text-outline uppercase text-center">Estado</div>
              <div className="col-span-1"></div>
           </div>

           {products.map((p, idx) => (
             <div key={p.id} className={`grid grid-cols-12 gap-4 items-center px-6 py-4 rounded-2xl transition-all duration-300 hover:bg-surface_container_highest cursor-pointer ${idx % 2 !== 0 ? 'bg-surface_container/50' : 'bg-transparent'}`}>
                {/* Visual del Producto */}
                <div className="col-span-5 flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-surface_container_highest flex items-center justify-center text-outline_variant">
                     <PackageOpen size={20} />
                   </div>
                   <div className="font-medium text-sm text-on_surface">{p.name}</div>
                </div>
                
                {/* Columnas de Datos */}
                <div className="col-span-2 text-sm text-on_surface_variant">{p.qty} un.</div>
                <div className="col-span-2 font-display font-medium text-on_surface">${p.price.toFixed(2)}</div>
                
                {/* Estado Tonal */}
                <div className="col-span-2 flex justify-center">
                   <span className={`text-[0.65rem] uppercase tracking-wider font-bold px-3 py-1 rounded-full ${
                     p.status === 'Crítico' ? 'bg-error_container/20 text-error' :
                     p.status === 'Bajo' ? 'bg-secondary_container text-on_secondary_container' :
                     'bg-tertiary_fixed_dim/20 text-tertiary_fixed_dim'
                   }`}>
                     {p.status}
                   </span>
                </div>

                {/* Acción Contextual */}
                <div className="col-span-1 flex justify-end">
                   <button className="text-outline_variant hover:text-primary transition-colors p-2">
                     <MoreHorizontal size={20} />
                   </button>
                </div>
             </div>
           ))}
        </div>

      </div>
    </div>
  );
}
