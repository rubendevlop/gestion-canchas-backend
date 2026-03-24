import { useState, useEffect } from 'react';
import { fetchAPI } from '../services/api';
import { Users, DollarSign, CalendarRange, TrendingUp, Plus, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState({ courts: [], reservations: [] });

  // Dashboard inspirado directamente en la estructura original generada por Stitch:
  // "Dashboard Principal - Gestión Pro"
  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-[2.5rem] font-display font-medium text-on_surface tracking-tight mb-1">
            Panel de Control
          </h2>
          <p className="text-on_surface_variant text-lg">
            Bienvenido de nuevo. Aquí tienes el resumen de hoy.
          </p>
        </div>
        
        <button className="bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold px-6 py-3 rounded-2xl flex items-center gap-2 shadow-[0_8px_30px_-10px_rgba(23,101,242,0.5)] hover:brightness-110 hover:scale-[1.02] transition-all">
          <Plus size={20} />
          Nueva Reserva
        </button>
      </header>

      {/* Métricas Principales - Asimetría Editorial */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-10">
        
        {/* Métrica Estrella (Más grande) */}
        <div className="md:col-span-5 bg-surface_container border border-outline_variant/10 rounded-[1.5rem] p-8 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full group-hover:bg-primary/20 transition-all"></div>
          <div>
            <p className="text-sm font-semibold tracking-[0.05em] uppercase text-outline mb-2">Ingresos Totales (Hoy)</p>
            <h3 className="text-5xl font-display font-bold text-on_surface">$42,850.00</h3>
          </div>
          <div className="mt-8 flex items-center gap-2 text-tertiary_fixed_dim font-medium bg-tertiary_fixed_dim/10 w-fit px-3 py-1 rounded-full text-sm">
            <TrendingUp size={16} /> +12.5% vs ayer
          </div>
        </div>

        {/* Métricas Secundarias */}
        <div className="md:col-span-4 bg-surface_container border border-outline_variant/10 rounded-[1.5rem] p-8 flex flex-col justify-between">
           <div>
            <p className="text-sm font-semibold tracking-[0.05em] uppercase text-outline mb-2">Reservas Confirmadas</p>
            <h3 className="text-4xl font-display font-medium text-on_surface">24 Turnos</h3>
          </div>
          <div className="mt-8">
            <div className="w-full bg-surface_container_highest h-2 rounded-full overflow-hidden">
               <div className="bg-primary h-full w-[80%] rounded-full shadow-[0_0_10px_rgba(179,197,255,0.8)]"></div>
            </div>
            <p className="text-xs text-outline mt-2 text-right">80% Ocupación</p>
          </div>
        </div>

        <div className="md:col-span-3 bg-surface_container border border-outline_variant/10 rounded-[1.5rem] p-8 flex flex-col justify-between">
           <div>
            <p className="text-sm font-semibold tracking-[0.05em] uppercase text-error mb-2">Stock Crítico</p>
            <h3 className="text-4xl font-display font-medium text-on_surface">4 Ítems</h3>
          </div>
          <LinkTo path="/dashboard/products" label="Ver Inventario" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Panel Próximos Turnos (Estilo Glass) */}
        <div className="card bg-surface_container_high rounded-[1.5rem] p-8">
          <div className="flex justify-between items-center mb-8">
             <h3 className="text-xl font-display font-medium text-on_surface">Próximos Ingresos</h3>
             <button className="text-sm font-medium text-primary hover:text-primary_fixed transition-colors">Ver Calendario Completo</button>
          </div>
          
          {/* Lista sin bordes / Spacing-6 */}
          <div className="space-y-6">
             <div className="flex items-center justify-between group cursor-pointer hover:bg-surface_container_highest -mx-4 px-4 py-3 rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-surface_container_low rounded-2xl flex items-center justify-center font-bold text-on_surface">19:00</div>
                   <div>
                      <p className="font-medium text-on_surface text-sm">Fútbol 5 - Cancha A</p>
                      <p className="text-xs text-outline">Reservado por: Carlos Mendoza</p>
                   </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-primary">$12,000</p>
                    <p className="text-[0.65rem] uppercase tracking-wider text-tertiary_fixed_dim font-bold">Señado</p>
                  </div>
                  <ChevronRight size={18} className="text-outline_variant group-hover:text-primary transition-colors" />
                </div>
             </div>

             <div className="flex items-center justify-between group cursor-pointer hover:bg-surface_container_highest -mx-4 px-4 py-3 rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-surface_container_low rounded-2xl flex items-center justify-center font-bold text-on_surface">20:00</div>
                   <div>
                      <p className="font-medium text-on_surface text-sm">Pádel - Pista 1</p>
                      <p className="text-xs text-outline">Reservado por: Ana Silva</p>
                   </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-on_surface">$8,500</p>
                    <p className="text-[0.65rem] uppercase tracking-wider text-error font-bold">Pendiente</p>
                  </div>
                  <ChevronRight size={18} className="text-outline_variant group-hover:text-primary transition-colors" />
                </div>
             </div>
          </div>
        </div>

        {/* Panel Alertas Generales */}
        <div className="card bg-surface_container rounded-[1.5rem] p-8 border hover:border-outline_variant/20 transition-colors border-transparent">
           <h3 className="text-xl font-display font-medium text-on_surface mb-8">Centro de Actividad</h3>
           <div className="text-center py-10 opacity-70">
              <CalendarRange size={48} className="mx-auto text-outline_variant mb-4" strokeWidth={1} />
              <p className="text-on_surface_variant text-sm">Tu día parece fluir con normalidad.<br/> No hay alertas urgentes pendientes.</p>
           </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponente Minimalista
function LinkTo({ path, label }) {
  return (
    <button className="flex items-center gap-2 text-sm text-primary hover:text-primary_fixed transition-colors font-medium mt-auto p-0 bg-transparent border-none">
      {label} <ChevronRight size={16} />
    </button>
  );
}
