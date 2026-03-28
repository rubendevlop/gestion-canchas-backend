import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  CircleOff,
  Clock3,
  DollarSign,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { fetchAPI } from '../services/api';
import ImageUploadField from '../components/ImageUploadField';
import { uploadImageToCloudinary } from '../services/cloudinary';
import { DEFAULT_BOOKING_HOURS, formatBookingHourRange, normalizeBookingHours } from '../utils/bookingHours';

const SPORT_OPTIONS = [
  { value: 'FUTBOL', label: 'Futbol' },
  { value: 'PADEL', label: 'Padel' },
  { value: 'TENIS', label: 'Tenis' },
  { value: 'BASKET', label: 'Basket' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  sport: 'FUTBOL',
  capacity: '',
  pricePerHour: '',
  bookingHours: [...DEFAULT_BOOKING_HOURS],
  isAvailable: true,
  image: '',
  imagePublicId: '',
};

const INPUT_CLS =
  'w-full rounded-2xl border border-outline_variant/15 bg-surface_container px-4 py-3 text-sm text-on_surface placeholder:text-outline focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15';

export default function Courts() {
  const [courts, setCourts] = useState([]);
  const [complex, setComplex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noComplex, setNoComplex] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [deleteCourt, setDeleteCourt] = useState(null);
  const [togglingId, setTogglingId] = useState('');

  useEffect(() => () => {
    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
  }, [imagePreviewUrl]);

  useEffect(() => {
    fetchAPI('/complexes/mine')
      .then(async (ownedComplex) => {
        setComplex(ownedComplex);
        const list = await fetchAPI(`/courts?complexId=${ownedComplex._id}`);
        setCourts(list);
      })
      .catch((error) => {
        if (error.status === 404) {
          setNoComplex(true);
          return;
        }
        alert(error.message || 'No se pudo cargar la informacion del complejo.');
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const available = courts.filter((court) => court.isAvailable).length;
    const unavailable = courts.length - available;
    const averagePrice = courts.length
      ? Math.round(
          courts.reduce((sum, court) => sum + Number(court.pricePerHour || 0), 0) / courts.length,
        )
      : 0;

    return { total: courts.length, available, unavailable, averagePrice };
  }, [courts]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    clearImageSelection();
    setModal({ mode: 'create' });
  };

  const openEdit = (court) => {
    setForm({
      name: court.name ?? '',
      description: court.description ?? '',
      sport: court.sport ?? 'FUTBOL',
      capacity: court.capacity?.toString() ?? '',
      pricePerHour: court.pricePerHour?.toString() ?? '',
      bookingHours: normalizeBookingHours(court.bookingHours),
      isAvailable: Boolean(court.isAvailable),
      image: court.image || court.imageUrl || court.images?.[0] || '',
      imagePublicId: court.imagePublicId || '',
    });
    clearImageSelection();
    setModal({ mode: 'edit', courtId: court._id });
  };

  const closeModal = () => {
    setModal(null);
    setForm(EMPTY_FORM);
    clearImageSelection();
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
      image: '',
      imagePublicId: '',
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!complex) return;

    setSaving(true);

    let payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      sport: form.sport,
      capacity: Number(form.capacity),
      pricePerHour: Number(form.pricePerHour),
      bookingHours: normalizeBookingHours(form.bookingHours),
      isAvailable: form.isAvailable,
      image: form.image,
      imagePublicId: form.imagePublicId,
    };

    try {
      if (imageFile) {
        setUploadingImage(true);
        const uploadedImage = await uploadImageToCloudinary(imageFile, 'court');
        payload = {
          ...payload,
          image: uploadedImage.image,
          imagePublicId: uploadedImage.imagePublicId,
        };
      }

      if (modal?.mode === 'create') {
        const created = await fetchAPI('/courts', {
          method: 'POST',
          body: JSON.stringify({ ...payload, complexId: complex._id }),
        });
        setCourts((current) => [created, ...current]);
      } else {
        const updated = await fetchAPI(`/courts/${modal.courtId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setCourts((current) =>
          current.map((court) => (court._id === updated._id ? updated : court)),
        );
      }

      closeModal();
    } catch (error) {
      alert(error.message || 'No se pudo guardar la cancha.');
    } finally {
      setUploadingImage(false);
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (court) => {
    setTogglingId(court._id);
    try {
      const updated = await fetchAPI(`/courts/${court._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isAvailable: !court.isAvailable }),
      });
      setCourts((current) => current.map((item) => (item._id === updated._id ? updated : item)));
    } catch (error) {
      alert(error.message || 'No se pudo actualizar la disponibilidad.');
    } finally {
      setTogglingId('');
    }
  };

  const handleDelete = async () => {
    if (!deleteCourt) return;
    try {
      await fetchAPI(`/courts/${deleteCourt._id}`, { method: 'DELETE' });
      setCourts((current) => current.filter((court) => court._id !== deleteCourt._id));
      setDeleteCourt(null);
    } catch (error) {
      alert(error.message || 'No se pudo eliminar la cancha.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (noComplex) {
    return <NoComplexBanner />;
  }

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-sm uppercase tracking-widest text-outline">
            {complex?.name || 'Mi complejo'}
          </p>
          <h2 className="text-[2rem] font-display font-medium tracking-tight text-on_surface sm:text-[2.5rem]">
            Canchas
          </h2>
          <p className="text-on_surface_variant">
            Gestiona horarios, capacidad y disponibilidad de tus espacios.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-6 py-3 font-semibold text-on_primary_fixed shadow-[0_8px_30px_-10px_rgba(47,172,76,0.42)] transition-all hover:scale-[1.01] hover:brightness-110 sm:w-auto"
        >
          <Plus size={20} />
          Nueva cancha
        </button>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<LayoutGrid size={16} />} label="Total" value={stats.total} hint="espacios cargados" />
        <StatCard icon={<CheckCircle2 size={16} />} label="Disponibles" value={stats.available} hint="listas para reservar" />
        <StatCard icon={<CircleOff size={16} />} label="Pausadas" value={stats.unavailable} hint="fuera de servicio" />
        <StatCard
          icon={<DollarSign size={16} />}
          label="Tarifa media"
          value={`$${stats.averagePrice.toLocaleString('es-AR')}`}
          hint="precio por hora"
        />
      </section>

      {courts.length === 0 ? (
        <EmptyCourtsState onCreate={openCreate} />
      ) : (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {courts.map((court) => (
            <article
              key={court._id}
              className="rounded-[1.75rem] border border-outline_variant/10 bg-surface_container_low p-5 sm:p-6"
            >
              <div className="mb-5 overflow-hidden rounded-[1.5rem] border border-outline_variant/10 bg-surface_container">
                {court.imageUrl || court.image ? (
                  <img
                    src={court.imageUrl || court.image}
                    alt={court.name}
                    className="h-52 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center bg-gradient-to-br from-primary/10 to-surface_container_highest text-outline">
                    <ImageIcon size={32} />
                  </div>
                )}
              </div>

              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge active={court.isAvailable} />
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                      {getSportLabel(court.sport)}
                    </span>
                  </div>
                  <h3 className="truncate text-xl font-display font-medium text-on_surface">{court.name}</h3>
                  <p className="mt-2 text-sm text-on_surface_variant">
                    {court.description?.trim() || 'Sin descripcion cargada todavia.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleAvailability(court)}
                  disabled={togglingId === court._id}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-colors ${
                    court.isAvailable
                      ? 'border-green-400/20 bg-green-400/10 text-green-400 hover:bg-green-400/15'
                      : 'border-outline_variant/20 bg-surface_container text-on_surface_variant hover:bg-surface_container_highest'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {togglingId === court._id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : court.isAvailable ? (
                    <ToggleRight size={16} />
                  ) : (
                    <ToggleLeft size={16} />
                  )}
                  {court.isAvailable ? 'Disponible' : 'Pausada'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <InfoTile icon={<Users size={15} />} label="Capacidad" value={`${court.capacity} personas`} />
                <InfoTile
                  icon={<DollarSign size={15} />}
                  label="Precio"
                  value={`$${Number(court.pricePerHour || 0).toLocaleString('es-AR')} / h`}
                />
                <InfoTile
                  icon={<Clock3 size={15} />}
                  label="Horarios"
                  value={formatBookingHourRange(court.bookingHours)}
                />
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => openEdit(court)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-outline_variant/20 px-4 py-3 text-sm font-medium text-on_surface transition-colors hover:bg-surface_container_highest"
                >
                  <Pencil size={16} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteCourt(court)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/15"
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Nueva cancha' : 'Editar cancha'} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Nombre">
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={INPUT_CLS}
                placeholder="Cancha 1"
                required
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Deporte">
                <select
                  value={form.sport}
                  onChange={(event) => setForm((current) => ({ ...current, sport: event.target.value }))}
                  className={INPUT_CLS}
                  required
                >
                  {SPORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Capacidad">
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
                  className={INPUT_CLS}
                  placeholder="10"
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Precio por hora">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.pricePerHour}
                  onChange={(event) => setForm((current) => ({ ...current, pricePerHour: event.target.value }))}
                  className={INPUT_CLS}
                  placeholder="18000"
                  required
                />
              </Field>

              <Field label="Estado inicial">
                <label className="flex h-[50px] items-center justify-between rounded-2xl border border-outline_variant/15 bg-surface_container px-4 text-sm text-on_surface">
                  <span>{form.isAvailable ? 'Disponible' : 'Pausada'}</span>
                  <input
                    type="checkbox"
                    checked={form.isAvailable}
                    onChange={(event) => setForm((current) => ({ ...current, isAvailable: event.target.checked }))}
                    className="h-4 w-4 rounded border-outline_variant/30 bg-surface_container accent-primary"
                  />
                </label>
              </Field>
            </div>

            <Field label="Horarios reservables">
              <div className="rounded-[1.5rem] border border-outline_variant/15 bg-surface_container p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-on_surface_variant">
                    Elige las horas que esta cancha puede recibir reservas.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        bookingHours:
                          current.bookingHours.length === DEFAULT_BOOKING_HOURS.length
                            ? []
                            : [...DEFAULT_BOOKING_HOURS],
                      }))
                    }
                    className="text-xs font-semibold uppercase tracking-widest text-primary"
                  >
                    {form.bookingHours.length === DEFAULT_BOOKING_HOURS.length ? 'Limpiar' : 'Completar'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {DEFAULT_BOOKING_HOURS.map((hour) => {
                    const active = form.bookingHours.includes(hour);

                    return (
                      <button
                        key={hour}
                        type="button"
                        onClick={() =>
                          setForm((current) => {
                            const nextHours = active
                              ? current.bookingHours.filter((item) => item !== hour)
                              : [...current.bookingHours, hour];

                            return {
                              ...current,
                              bookingHours: normalizeBookingHours(nextHours),
                            };
                          })
                        }
                        className={`rounded-2xl border px-3 py-2 text-sm font-medium transition-all ${
                          active
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-outline_variant/15 bg-surface_container_highest text-on_surface_variant hover:border-primary/30 hover:text-on_surface'
                        }`}
                      >
                        {hour}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-outline">
                  Franja activa:{' '}
                  {form.bookingHours.length > 0
                    ? formatBookingHourRange(form.bookingHours)
                    : 'Selecciona al menos una hora'}
                </p>
              </div>
            </Field>

            <Field label="Descripcion">
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className={INPUT_CLS}
                placeholder="Detalles sobre medidas, tipo de piso o reglas."
              />
            </Field>

            <ImageUploadField
              label="Foto principal"
              imageUrl={form.image}
              previewUrl={imagePreviewUrl}
              onSelectFile={handleImageSelection}
              onClear={handleClearImage}
              hint="Se recomienda una foto horizontal de la cancha para mostrarla en reservas y en el portal."
            />

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-2xl border border-outline_variant/20 px-4 py-3 text-sm font-medium text-on_surface_variant transition-colors hover:bg-surface_container_highest"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || form.bookingHours.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-4 py-3 text-sm font-semibold text-on_primary_fixed transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {saving ? (uploadingImage ? 'Subiendo imagen...' : 'Guardando...') : 'Guardar cancha'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteCourt && (
        <Modal title="Eliminar cancha" onClose={() => setDeleteCourt(null)}>
          <p className="text-sm text-on_surface_variant">
            Vas a eliminar <span className="font-semibold text-on_surface">{deleteCourt.name}</span>. Esta accion no se puede deshacer.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setDeleteCourt(null)}
              className="flex-1 rounded-2xl border border-outline_variant/20 px-4 py-3 text-sm font-medium text-on_surface_variant transition-colors hover:bg-surface_container_highest"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500/90"
            >
              <Trash2 size={16} />
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, hint }) {
  return (
    <article className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-5">
      <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div>
      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-outline">{label}</p>
      <h3 className="mt-2 text-3xl font-display font-medium text-on_surface">{value}</h3>
      <p className="mt-1 text-sm text-on_surface_variant">{hint}</p>
    </article>
  );
}

function InfoTile({ icon, label, value }) {
  return (
    <div className="rounded-2xl bg-surface_container p-4">
      <div className="mb-3 flex items-center gap-2 text-outline">
        {icon}
        <span className="text-xs uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-medium text-on_surface">{value}</p>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
        active ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
      }`}
    >
      {active ? 'Activa' : 'Pausada'}
    </span>
  );
}

function EmptyCourtsState({ onCreate }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-outline_variant/20 bg-surface_container_low px-6 py-12 text-center sm:px-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Plus size={28} />
      </div>
      <h3 className="text-2xl font-display font-medium text-on_surface">Todavia no cargaste canchas</h3>
      <p className="mx-auto mt-3 max-w-xl text-on_surface_variant">
        Crea tu primera cancha para definir precios, capacidad y empezar a administrar las reservas del complejo.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-6 py-3 font-semibold text-on_primary_fixed transition-all hover:brightness-110"
      >
        <Plus size={18} />
        Crear primera cancha
      </button>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-outline_variant/15 bg-surface_container_low p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3 className="text-xl font-display font-semibold text-on_surface">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-outline transition-colors hover:bg-surface_container hover:text-on_surface"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-outline">
        {label}
      </label>
      {children}
    </div>
  );
}

function NoComplexBanner() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-24 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Building2 size={28} className="text-primary" />
      </div>
      <h3 className="mb-2 text-2xl font-display font-medium text-on_surface">Configura tu complejo primero</h3>
      <p className="mb-6 text-sm text-on_surface_variant">
        Antes de administrar canchas necesitas registrar tu complejo con nombre y direccion.
      </p>
      <Link
        to="/dashboard/settings"
        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-8 py-3.5 font-semibold text-on_primary_fixed transition-all hover:brightness-110"
      >
        <Building2 size={16} />
        Configurar complejo
      </Link>
    </div>
  );
}

function getSportLabel(value) {
  return SPORT_OPTIONS.find((option) => option.value === value)?.label || value;
}
