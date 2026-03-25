import { useState, useEffect } from 'react';
import { fetchAPI } from '../services/api';
import {
  Building2, Clock, Phone, MapPin, Save, Loader2,
  CheckCircle2, Globe, Pencil
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const INPUT_CLS = "w-full bg-surface_container border border-outline_variant/15 rounded-xl py-3 px-4 text-on_surface placeholder-outline text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all";

const EMPTY_FORM = {
  name: '', address: '', phone: '',
  openingHours: { start: '08:00', end: '23:00' },
};

export default function Settings() {
  const { user } = useAuth();
  const [complex, setComplex] = useState(null);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [isNew, setIsNew]     = useState(false);

  useEffect(() => {
    fetchAPI('/complexes/mine')
      .then((comp) => {
        setComplex(comp);
        setForm({
          name:    comp.name || '',
          address: comp.address || '',
          phone:   comp.phone || '',
          openingHours: comp.openingHours || { start: '08:00', end: '23:00' },
        });
      })
      .catch((error) => {
        if (error.status === 404) {
          setIsNew(true);
          return;
        }
        alert(error.message || 'No se pudo cargar la configuracion del complejo.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let saved;
      if (isNew) {
        saved = await fetchAPI('/complexes', { method: 'POST', body: JSON.stringify(form) });
        setIsNew(false);
      } else {
        saved = await fetchAPI(`/complexes/${complex._id}`, { method: 'PUT', body: JSON.stringify(form) });
      }
      setComplex(saved);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  if (loading) return <div className="flex justify-center pt-32"><Loader2 className="animate-spin text-primary" size={40}/></div>;

  return (
    <div className="animate-fade-in pb-10 max-w-2xl">
      <header className="mb-10">
        <h2 className="text-[2.5rem] font-display font-medium text-on_surface tracking-tight">Ajustes del Complejo</h2>
        <p className="text-on_surface_variant">
          {isNew ? 'Configurá tu complejo para que los clientes puedan encontrarte.' : 'Actualizá la información visible para tus clientes.'}
        </p>
      </header>

      {/* Banner de éxito */}
      {saved && (
        <div className="mb-6 bg-green-400/10 border border-green-400/20 rounded-2xl px-5 py-3 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-green-400 shrink-0"/>
          <p className="text-green-400 text-sm font-medium">¡Cambios guardados correctamente!</p>
        </div>
      )}

      {/* Banner para nuevo complejo */}
      {isNew && (
        <div className="mb-8 bg-primary/5 border border-primary/15 rounded-2xl px-5 py-4">
          <p className="text-primary font-semibold text-sm flex items-center gap-2 mb-1">
            <Building2 size={16}/> Primer configuración
          </p>
          <p className="text-on_surface_variant text-sm">
            Completá los datos de tu complejo. Una vez creado, aparecerá en el portal para que los clientes puedan hacer reservas.
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Sección: Info básica */}
        <Section title="Información General" icon={<Building2 size={18}/>}>
          <Field label="Nombre del complejo *">
            <input type="text" placeholder="Complejo Deportivo Las Flores" value={form.name}
              onChange={(e) => setField('name', e.target.value)} className={INPUT_CLS} required/>
          </Field>
          <Field label="Dirección *">
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"/>
              <input type="text" placeholder="Av. Siempreverde 1234, Buenos Aires" value={form.address}
                onChange={(e) => setField('address', e.target.value)} className={`${INPUT_CLS} pl-9`} required/>
            </div>
          </Field>
          <Field label="Teléfono de contacto">
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"/>
              <input type="tel" placeholder="+54 11 1234-5678" value={form.phone}
                onChange={(e) => setField('phone', e.target.value)} className={`${INPUT_CLS} pl-9`}/>
            </div>
          </Field>
        </Section>

        {/* Sección: Horarios */}
        <Section title="Horario de Atención" icon={<Clock size={18}/>}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Apertura">
              <input type="time" value={form.openingHours.start}
                onChange={(e) => setField('openingHours', { ...form.openingHours, start: e.target.value })}
                className={INPUT_CLS}/>
            </Field>
            <Field label="Cierre">
              <input type="time" value={form.openingHours.end}
                onChange={(e) => setField('openingHours', { ...form.openingHours, end: e.target.value })}
                className={INPUT_CLS}/>
            </Field>
          </div>
          <p className="text-xs text-outline mt-2">El complejo estará visible para reservas durante este rango horario.</p>
        </Section>

        {/* Cuenta (solo lectura) */}
        <Section title="Información de Cuenta" icon={<Globe size={18}/>}>
          <div className="bg-surface_container rounded-2xl p-4 space-y-3">
            <ReadRow label="Email" value={user?.email} />
            <ReadRow label="Nombre" value={user?.displayName} />
            {complex && <ReadRow label="ID Complejo" value={complex._id} mono />}
          </div>
          <p className="text-xs text-outline mt-2">Para cambiar tu email o contraseña, usá la configuración de Google.</p>
        </Section>

        {/* CTA guardar */}
        <button type="submit" disabled={saving}
          className="w-full bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-bold py-4 rounded-2xl hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_30px_-10px_rgba(23,101,242,0.4)]">
          {saving ? <Loader2 size={18} className="animate-spin"/> : saved ? <CheckCircle2 size={18}/> : <Save size={18}/>}
          {saving ? 'Guardando...' : saved ? '¡Guardado!' : isNew ? 'Crear mi complejo' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-semibold text-on_surface mb-4 pb-3 border-b border-outline_variant/10">
        <span className="text-primary">{icon}</span>{title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-outline uppercase tracking-wider mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function ReadRow({ label, value, mono }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-outline">{label}</span>
      <span className={`text-on_surface_variant ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</span>
    </div>
  );
}
