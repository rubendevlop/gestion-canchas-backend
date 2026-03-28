import { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  Save,
} from 'lucide-react';
import ImageUploadField from '../components/ImageUploadField';
import { useAuth } from '../contexts/AuthContext';
import { uploadImageToCloudinary } from '../services/cloudinary';
import { fetchAPI } from '../services/api';

const INPUT_CLS =
  'w-full rounded-xl border border-outline_variant/15 bg-surface_container px-4 py-3 text-sm text-on_surface placeholder-outline transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20';

const EMPTY_FORM = {
  name: '',
  address: '',
  phone: '',
  logo: '',
  logoPublicId: '',
  openingHours: {
    start: '08:00',
    end: '23:00',
  },
};

export default function Settings() {
  const { user } = useAuth();
  const [complex, setComplex] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  useEffect(() => () => {
    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
  }, [imagePreviewUrl]);

  useEffect(() => {
    fetchAPI('/complexes/mine')
      .then((ownedComplex) => {
        setComplex(ownedComplex);
        setForm({
          name: ownedComplex.name || '',
          address: ownedComplex.address || '',
          phone: ownedComplex.phone || '',
          logo: ownedComplex.logo || ownedComplex.imageUrl || '',
          logoPublicId: ownedComplex.logoPublicId || '',
          openingHours: ownedComplex.openingHours || { start: '08:00', end: '23:00' },
        });
      })
      .catch((error) => {
        const message = String(error?.message || '').toLowerCase();
        if (message.includes('no tenes ningun complejo configurado')) {
          setIsNew(true);
          return;
        }

        alert(error.message || 'No se pudo cargar la configuracion del complejo.');
      })
      .finally(() => setLoading(false));
  }, []);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const clearImageSelection = () => {
    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImagePreviewUrl('');
    setImageFile(null);
  };

  const handleImageSelection = (file) => {
    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    if (!file) {
      setImagePreviewUrl('');
      setImageFile(null);
      return;
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    clearImageSelection();
    setForm((current) => ({
      ...current,
      logo: '',
      logoPublicId: '',
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);

    let payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      logo: form.logo,
      logoPublicId: form.logoPublicId,
      openingHours: {
        start: form.openingHours.start,
        end: form.openingHours.end,
      },
    };

    try {
      if (imageFile) {
        setUploadingImage(true);
        const uploadedImage = await uploadImageToCloudinary(imageFile, 'complex');
        payload = {
          ...payload,
          logo: uploadedImage.image,
          logoPublicId: uploadedImage.imagePublicId,
        };
      }

      const savedComplex = isNew
        ? await fetchAPI('/complexes', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
        : await fetchAPI(`/complexes/${complex._id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });

      setComplex(savedComplex);
      setForm({
        name: savedComplex.name || '',
        address: savedComplex.address || '',
        phone: savedComplex.phone || '',
        logo: savedComplex.logo || savedComplex.imageUrl || '',
        logoPublicId: savedComplex.logoPublicId || '',
        openingHours: savedComplex.openingHours || { start: '08:00', end: '23:00' },
      });
      setIsNew(false);
      clearImageSelection();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      alert(error.message || 'Error al guardar la configuracion del complejo.');
    } finally {
      setUploadingImage(false);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center pt-32">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl animate-fade-in pb-10">
      <header className="mb-10">
        <h2 className="text-[2.5rem] font-display font-medium tracking-tight text-on_surface">
          Ajustes del Complejo
        </h2>
        <p className="text-on_surface_variant">
          {isNew
            ? 'Configura tu complejo para empezar a mostrarlo en el portal y aceptar reservas.'
            : 'Actualiza la informacion visible para clientes, reservas y tienda.'}
        </p>
      </header>

      {saved && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-400/20 bg-green-400/10 px-5 py-3">
          <CheckCircle2 size={18} className="shrink-0 text-green-400" />
          <p className="text-sm font-medium text-green-400">Cambios guardados correctamente.</p>
        </div>
      )}

      {isNew && (
        <div className="mb-8 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
            <Building2 size={16} />
            Primer configuracion
          </p>
          <p className="text-sm text-on_surface_variant">
            Completa estos datos para habilitar la imagen, los horarios y la informacion publica
            del complejo.
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        <Section title="Identidad del complejo" icon={<Building2 size={18} />}>
          <ImageUploadField
            label="Logo o portada"
            imageUrl={form.logo}
            previewUrl={imagePreviewUrl}
            onSelectFile={handleImageSelection}
            onClear={handleClearImage}
            hint="Se mostrara en el portal publico del complejo. Recomendado: imagen horizontal y liviana."
          />

          <Field label="Nombre del complejo *">
            <input
              type="text"
              placeholder="Complejo Deportivo Las Flores"
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              className={INPUT_CLS}
              required
            />
          </Field>

          <Field label="Direccion *">
            <div className="relative">
              <MapPin
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline"
              />
              <input
                type="text"
                placeholder="Av. Siempreverde 1234, Tucuman"
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
                className={`${INPUT_CLS} pl-9`}
                required
              />
            </div>
          </Field>

          <Field label="Telefono de contacto">
            <div className="relative">
              <Phone
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline"
              />
              <input
                type="tel"
                placeholder="+54 381 555-1234"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
                className={`${INPUT_CLS} pl-9`}
              />
            </div>
          </Field>
        </Section>

        <Section title="Horarios" icon={<Clock size={18} />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Apertura">
              <input
                type="time"
                value={form.openingHours.start}
                onChange={(event) =>
                  setField('openingHours', {
                    ...form.openingHours,
                    start: event.target.value,
                  })
                }
                className={INPUT_CLS}
              />
            </Field>

            <Field label="Cierre">
              <input
                type="time"
                value={form.openingHours.end}
                onChange={(event) =>
                  setField('openingHours', {
                    ...form.openingHours,
                    end: event.target.value,
                  })
                }
                className={INPUT_CLS}
              />
            </Field>
          </div>

          <p className="text-xs text-outline">
            Este rango se usa como referencia general del complejo en el portal.
          </p>
        </Section>

        <Section title="Cuenta" icon={<Globe size={18} />}>
          <div className="space-y-3 rounded-2xl bg-surface_container p-4">
            <ReadRow label="Email" value={user?.email} />
            <ReadRow label="Nombre" value={user?.displayName} />
            {complex && <ReadRow label="ID Complejo" value={complex._id} mono />}
          </div>
          <p className="text-xs text-outline">
            La imagen se guarda en Cloudinary usando las credenciales del backend.
          </p>
        </Section>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary py-4 font-bold text-on_primary_fixed shadow-[0_8px_30px_-10px_rgba(47,172,76,0.4)] transition-all hover:brightness-110 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : saved ? (
            <CheckCircle2 size={18} />
          ) : uploadingImage ? (
            <ImageIcon size={18} />
          ) : (
            <Save size={18} />
          )}
          {saving
            ? uploadingImage
              ? 'Subiendo imagen...'
              : 'Guardando...'
            : saved
              ? 'Guardado'
              : isNew
                ? 'Crear mi complejo'
                : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 border-b border-outline_variant/10 pb-3 text-base font-semibold text-on_surface">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-outline">
        {label}
      </label>
      {children}
    </div>
  );
}

function ReadRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-outline">{label}</span>
      <span className={`text-right text-on_surface_variant ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '-'}
      </span>
    </div>
  );
}
