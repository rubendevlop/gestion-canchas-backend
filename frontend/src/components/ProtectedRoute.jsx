import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Clock,
  CreditCard,
  Loader2,
  LogOut,
  RefreshCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { logout } from '../auth';
import { useAuth } from '../contexts/AuthContext';
import { fetchAPI } from '../services/api';
import MercadoPagoCardModal from './MercadoPagoCardModal';
import DashboardLayout from '../layouts/DashboardLayout';

const LOADING_SCREEN = (
  <div className="min-h-screen flex items-center justify-center bg-background px-6">
    <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-outline_variant/20 bg-white px-8 py-10 shadow-[0_28px_60px_-36px_rgba(24,36,24,0.22)]">
      <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <p className="text-on_surface_variant text-sm">Verificando sesion...</p>
    </div>
  </div>
);

function AdminPanelState({ children }) {
  return (
    <DashboardLayout>
      <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center">
        {children}
      </div>
    </DashboardLayout>
  );
}

function PendingApprovalScreen() {
  return (
    <AdminPanelState>
      <div className="w-full rounded-[2rem] border border-outline_variant/20 bg-white/92 p-8 shadow-[0_32px_72px_-40px_rgba(24,36,24,0.22)] sm:p-10">
        <div className="flex h-18 w-18 items-center justify-center rounded-[1.75rem] bg-yellow-400/12 text-yellow-500">
          <Clock size={34} />
        </div>
        <h1 className="mt-6 text-3xl font-display font-bold text-on_surface">Solicitud en revision</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-on_surface_variant">
          Tu solicitud para operar como <span className="font-semibold text-on_surface">Dueno de complejo</span> esta siendo revisada por un superadmin. Cuando se apruebe vas a poder gestionar canchas, reservas y productos desde este mismo panel.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl bg-surface_container_low p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">Estado</p>
            <p className="mt-2 text-lg font-semibold text-on_surface">Pendiente de aprobacion</p>
            <p className="mt-2 text-sm text-on_surface_variant">Todavia no hace falta que cargues nada mas.</p>
          </div>
          <div className="rounded-3xl bg-surface_container_low p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">Tiempo estimado</p>
            <p className="mt-2 text-lg font-semibold text-on_surface">24 a 48 hs habiles</p>
            <p className="mt-2 text-sm text-on_surface_variant">Te avisaremos cuando el acceso quede habilitado.</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <LogoutButton className="sm:w-auto sm:px-6" />
        </div>
      </div>
    </AdminPanelState>
  );
}

function RejectedScreen({ note }) {
  return (
    <AdminPanelState>
      <div className="w-full rounded-[2rem] border border-outline_variant/20 bg-white/92 p-8 shadow-[0_32px_72px_-40px_rgba(24,36,24,0.22)] sm:p-10">
        <div className="flex h-18 w-18 items-center justify-center rounded-[1.75rem] bg-red-500/10 text-red-500">
          <XCircle size={34} />
        </div>
        <h1 className="mt-6 text-3xl font-display font-bold text-on_surface">Solicitud rechazada</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-on_surface_variant">
          La solicitud para operar como <span className="font-semibold text-on_surface">Dueno de complejo</span> fue rechazada. Desde este panel podes revisar la observacion y volver a intentar cuando corresponda.
        </p>

        {note && (
          <div className="mt-8 rounded-3xl border border-red-500/15 bg-red-500/5 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">Observacion</p>
            <p className="mt-2 text-sm leading-relaxed text-on_surface_variant">{note}</p>
          </div>
        )}

        <p className="mt-6 text-sm text-outline">
          Si hace falta, podes contactarte con soporte para corregir la solicitud antes de volver a presentarla.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <LogoutButton className="sm:w-auto sm:px-6" />
        </div>
      </div>
    </AdminPanelState>
  );
}

function BillingRequiredScreen({ ownerBilling, refreshProfile, user }) {
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentSession, setPaymentSession] = useState(null);

  const currentInvoice = ownerBilling?.currentInvoice;
  const amountLabel =
    typeof ownerBilling?.amount === 'number'
      ? `$${ownerBilling.amount.toLocaleString('es-AR')}`
      : 'Monto pendiente';

  const handleCheckout = async () => {
    setLoadingCheckout(true);
    setMessage('');

    try {
      const response = await fetchAPI('/owner-billing/checkout', { method: 'POST' });
      if (!response.paymentSession?.invoiceId) {
        throw new Error('No se pudo preparar la sesion de pago.');
      }
      setPaymentSession(response.paymentSession);
    } catch (error) {
      setMessage(error.message || 'No se pudo iniciar el pago.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleProcessPayment = async (formData, additionalData) => {
    const response = await fetchAPI('/owner-billing/checkout/process-order', {
      method: 'POST',
      body: JSON.stringify({
        invoiceId: paymentSession?.invoiceId || currentInvoice?.id,
        formData,
        additionalData,
      }),
    });

    setPaymentSession(null);
    await refreshProfile();

    if (response.invoice?.status !== 'PAID') {
      setMessage('El pago fue enviado. Actualiza el estado en unos segundos para confirmar la acreditacion.');
    }
  };

  const handleRefresh = async () => {
    setLoadingRefresh(true);
    setMessage('');

    try {
      await refreshProfile();
    } catch (error) {
      setMessage(error.message || 'No se pudo actualizar el estado del pago.');
    } finally {
      setLoadingRefresh(false);
    }
  };

  return (
    <AdminPanelState>
      <div className="w-full rounded-[2rem] border border-outline_variant/20 bg-white/92 p-8 shadow-[0_32px_72px_-40px_rgba(24,36,24,0.22)] sm:p-10">
        <div className="flex h-18 w-18 items-center justify-center rounded-[1.75rem] bg-primary/10 text-primary">
          <CreditCard size={34} />
        </div>
        <h1 className="mt-6 text-3xl font-display font-bold text-on_surface">Pago mensual requerido</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-on_surface_variant">
          Tu cuenta owner ya fue aprobada, pero para usar el panel tenes que abonar la mensualidad del complejo mediante un pago directo con Mercado Pago.
        </p>

        <div className="mt-8 rounded-[1.75rem] bg-surface_container_low p-5 text-left">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Estado" value="Pendiente de pago" />
            <Row label="Mensualidad" value={amountLabel} />
            <Row
              label="Vence"
              value={currentInvoice?.dueDate ? formatDate(currentInvoice.dueDate) : 'Pendiente'}
            />
            <Row label="Proveedor" value="Mercado Pago" />
          </div>
        </div>

        {!ownerBilling?.providerConfigured && (
          <div className="mt-6 rounded-3xl border border-yellow-400/15 bg-yellow-400/5 px-5 py-4 text-left">
            <p className="flex items-center gap-2 text-sm font-medium text-yellow-500">
              <ShieldAlert size={16} />
              Mercado Pago todavia no esta configurado.
            </p>
            <p className="mt-2 text-sm text-on_surface_variant">
              Hasta que se carguen la clave privada y la publica no se va a poder generar el cobro mensual.
            </p>
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-3xl border border-red-500/15 bg-red-500/5 px-5 py-4 text-sm text-red-500">
            {message}
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loadingCheckout || !ownerBilling?.providerConfigured}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold py-3.5 rounded-2xl hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loadingCheckout ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            {loadingCheckout ? 'Preparando pago...' : 'Pagar mensualidad'}
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loadingRefresh}
            className="w-full flex items-center justify-center gap-2 bg-surface_container border border-outline_variant/20 text-on_surface_variant py-3 rounded-2xl hover:bg-surface_container_highest transition-colors text-sm disabled:opacity-50"
          >
            {loadingRefresh ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            {loadingRefresh ? 'Actualizando...' : 'Ya pague, actualizar estado'}
          </button>

          <LogoutButton className="sm:w-auto sm:px-5" />
        </div>

        <MercadoPagoCardModal
          open={Boolean(paymentSession)}
          title="Pagar mensualidad"
          subtitle="Completa el pago desde este bloqueo para volver a habilitar el panel."
          amount={Number(paymentSession?.amount || ownerBilling?.amount || 0)}
          currency={paymentSession?.currency || ownerBilling?.currency || 'ARS'}
          payerEmail={paymentSession?.payer?.email || user?.email || ''}
          allowPayerEmailEdit={!paymentSession?.payer?.usesConfiguredTestEmail}
          payerEmailHelpText="Si estas usando credenciales de prueba, carga el email de un comprador de prueba de Mercado Pago. No uses tu email real."
          submitLabel="mensualidad"
          onClose={() => setPaymentSession(null)}
          onSubmit={handleProcessPayment}
        />
      </div>
    </AdminPanelState>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-outline">{label}</span>
      <span className="text-sm font-medium text-on_surface text-right">{value}</span>
    </div>
  );
}

function LogoutButton({ className = '' }) {
  return (
    <button
      onClick={() => logout().then(() => { window.location.href = '/login'; })}
      className={`flex items-center justify-center gap-2 w-full bg-surface_container border border-outline_variant/20 text-on_surface_variant py-3 rounded-2xl hover:bg-surface_container_highest transition-colors text-sm ${className}`.trim()}
    >
      <LogOut size={16} /> Cerrar sesion
    </button>
  );
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, ownerStatus, ownerStatusNote, ownerBilling, loading, refreshProfile } = useAuth();

  if (loading) return LOADING_SCREEN;
  if (!user) return <Navigate to="/login" replace />;
  if (!role) return <Navigate to="/login" replace />;

  if (role === 'owner' && allowedRoles?.includes('owner')) {
    if (ownerStatus === 'PENDING') return <PendingApprovalScreen />;
    if (ownerStatus === 'REJECTED') return <RejectedScreen note={ownerStatusNote} />;
    if (ownerStatus === 'APPROVED' && ownerBilling?.required && !ownerBilling?.hasAccess) {
      return <BillingRequiredScreen ownerBilling={ownerBilling} refreshProfile={refreshProfile} user={user} />;
    }
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === 'client') return <Navigate to="/portal" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
