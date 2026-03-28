import { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { logout } from '../../auth';
import { useAuth } from '../../contexts/AuthContext';
import { sendPasswordResetLink, updateFirebaseUserProfile } from '../../firebase';
import { fetchAPI } from '../../services/api';

const INPUT_CLS =
  'w-full rounded-2xl border border-outline_variant/20 bg-surface_container_low px-4 py-3 text-sm text-on_surface placeholder-outline transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15';

export default function PortalProfile() {
  const { user, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    displayName: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      displayName: user?.displayName || '',
      phone: user?.phone || '',
    });
  }, [user?.displayName, user?.phone]);

  const supportsPasswordReset = useMemo(
    () =>
      Array.isArray(user?.providerData) &&
      user.providerData.some((provider) => provider?.providerId === 'password'),
    [user?.providerData],
  );

  const providerLabel = supportsPasswordReset ? 'Email y contrasena' : 'Google';

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await fetchAPI('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: form.displayName,
          phone: form.phone,
        }),
      });

      await updateFirebaseUserProfile({ displayName: form.displayName.trim() });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      alert(error.message || 'No se pudo actualizar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleSecurityAction = async () => {
    if (!user?.email) {
      return;
    }

    if (!supportsPasswordReset) {
      window.open('https://myaccount.google.com/security', '_blank', 'noopener,noreferrer');
      return;
    }

    setSendingReset(true);
    try {
      await sendPasswordResetLink(user.email);
      alert('Te enviamos un correo para cambiar tu contrasena.');
    } catch (error) {
      alert(error.message || 'No se pudo enviar el correo de recuperacion.');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-on_surface">Mi perfil</h1>
        <p className="mt-2 text-on_surface_variant">
          Administra tus datos personales y revisa como se gestiona tu acceso.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px]">
        <section className="rounded-[2rem] border border-outline_variant/20 bg-white p-6 shadow-[0_22px_48px_-34px_rgba(24,36,24,0.2)] sm:p-8">
          <div className="mb-8 flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                className="h-20 w-20 rounded-full border border-outline_variant/15 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/12 text-3xl font-bold text-primary">
                {user?.displayName?.charAt(0) || 'U'}
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold text-on_surface">{user?.displayName || 'Cliente'}</h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-on_surface_variant">
                <Mail size={14} />
                {user?.email || 'Sin email'}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                Cliente
              </span>
            </div>
          </div>

          {saved && (
            <div className="mb-6 rounded-2xl border border-green-400/20 bg-green-400/10 px-4 py-3 text-sm font-medium text-green-600">
              Tus datos se guardaron correctamente.
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <Field label="Nombre visible">
              <div className="relative">
                <UserRound
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline"
                />
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, displayName: event.target.value }))
                  }
                  placeholder="Tu nombre"
                  className={`${INPUT_CLS} pl-11`}
                  required
                />
              </div>
            </Field>

            <Field label="Telefono">
              <div className="relative">
                <Phone
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline"
                />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+54 381 555-1234"
                  className={`${INPUT_CLS} pl-11`}
                />
              </div>
            </Field>

            <Field label="Email de acceso">
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className={`${INPUT_CLS} cursor-not-allowed opacity-70`}
              />
            </Field>

            <div className="rounded-2xl border border-outline_variant/15 bg-surface_container_low px-4 py-4 text-sm text-on_surface_variant">
              El email y el metodo de acceso dependen del proveedor con el que iniciaste sesion.
              Hoy tu cuenta usa <span className="font-semibold text-on_surface">{providerLabel}</span>.
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary py-3.5 font-semibold text-on_primary_fixed transition-all hover:brightness-110 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-outline_variant/20 bg-white p-6 shadow-[0_22px_48px_-34px_rgba(24,36,24,0.2)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-on_surface">Seguridad</h2>
                <p className="text-sm text-on_surface_variant">Gestiona tu acceso y recuperacion.</p>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-outline_variant/15 bg-surface_container_low px-4 py-4 text-sm text-on_surface_variant">
              {supportsPasswordReset
                ? 'Tu cuenta admite recuperacion por correo. Puedes enviarte un enlace para cambiar la contrasena.'
                : 'Tu acceso se gestiona con Google. Para cambiar seguridad o contrasena debes hacerlo desde tu cuenta de Google.'}
            </div>

            <button
              type="button"
              onClick={handleSecurityAction}
              disabled={sendingReset}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-outline_variant/20 bg-surface_container_low px-4 py-3 text-sm font-medium text-on_surface transition-colors hover:border-primary/20 hover:bg-surface_container disabled:opacity-60"
            >
              {sendingReset ? (
                <Loader2 size={16} className="animate-spin" />
              ) : supportsPasswordReset ? (
                <KeyRound size={16} />
              ) : (
                <ExternalLink size={16} />
              )}
              {supportsPasswordReset ? 'Enviar cambio de contrasena' : 'Abrir seguridad de Google'}
            </button>
          </section>

          <section className="rounded-[2rem] border border-outline_variant/20 bg-white p-6 shadow-[0_22px_48px_-34px_rgba(24,36,24,0.2)]">
            <h2 className="mb-4 font-semibold text-on_surface">Sesion</h2>
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-outline_variant/25 py-3 text-sm font-medium text-on_surface_variant transition-all hover:border-error/30 hover:text-error"
            >
              <LogOut size={16} />
              Cerrar sesion
            </button>
          </section>
        </aside>
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
