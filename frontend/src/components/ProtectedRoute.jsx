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

const LOADING_SCREEN = (
  <div className="min-h-screen flex items-center justify-center bg-[#131313]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-on_surface_variant text-sm">Verificando sesion...</p>
    </div>
  </div>
);

function PendingApprovalScreen() {
  return (
    <div className="min-h-screen bg-[#131313] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-3xl bg-yellow-400/10 flex items-center justify-center mx-auto mb-6">
          <Clock size={36} className="text-yellow-400" />
        </div>
        <h1 className="text-3xl font-display font-bold text-on_surface mb-3">Solicitud en revision</h1>
        <p className="text-on_surface_variant mb-6 leading-relaxed">
          Tu solicitud para operar como <span className="font-semibold text-on_surface">Dueno de Complejo</span> esta siendo revisada por un superadmin.
          Hasta que sea aprobada no podes entrar al panel ni gestionar canchas, reservas o productos.
        </p>
        <div className="bg-surface_container rounded-2xl p-4 text-left space-y-2 mb-8">
          <p className="flex items-center gap-2 text-sm text-on_surface_variant">
            <Clock size={14} className="text-yellow-400 shrink-0" />
            Revision estimada: 24-48 hs habiles
          </p>
          <p className="flex items-center gap-2 text-sm text-on_surface_variant">
            <Clock size={14} className="text-yellow-400 shrink-0" />
            Cuando te validen, vas a poder ingresar como dueno
          </p>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}

function RejectedScreen({ note }) {
  return (
    <div className="min-h-screen bg-[#131313] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-3xl bg-red-400/10 flex items-center justify-center mx-auto mb-6">
          <XCircle size={36} className="text-red-400" />
        </div>
        <h1 className="text-3xl font-display font-bold text-on_surface mb-3">Solicitud rechazada</h1>
        <p className="text-on_surface_variant mb-4 leading-relaxed">
          Tu solicitud para operar como <span className="font-semibold text-on_surface">Dueno de Complejo</span> fue rechazada.
        </p>
        {note && (
          <div className="bg-red-400/5 border border-red-400/15 rounded-2xl px-5 py-4 mb-6 text-left">
            <p className="text-xs text-outline uppercase tracking-wider mb-1">Motivo:</p>
            <p className="text-sm text-on_surface_variant">{note}</p>
          </div>
        )}
        <p className="text-sm text-outline mb-8">Podes contactarnos para mas informacion o registrarte como cliente.</p>
        <LogoutButton />
      </div>
    </div>
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
    <div className="min-h-screen bg-[#131313] flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <CreditCard size={36} className="text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold text-on_surface mb-3">Pago mensual requerido</h1>
        <p className="text-on_surface_variant mb-6 leading-relaxed">
          Tu cuenta owner ya fue aprobada, pero para usar el panel tenes que abonar la mensualidad del complejo mediante un pago directo de Mercado Pago.
        </p>

        <div className="bg-surface_container rounded-3xl p-5 text-left space-y-3 mb-6">
          <Row label="Estado" value="Pendiente de pago" />
          <Row label="Mensualidad" value={amountLabel} />
          <Row
            label="Vence"
            value={currentInvoice?.dueDate ? formatDate(currentInvoice.dueDate) : 'Pendiente'}
          />
          <Row label="Proveedor" value="Mercado Pago" />
        </div>

        {!ownerBilling?.providerConfigured && (
          <div className="mb-6 rounded-2xl border border-yellow-400/15 bg-yellow-400/5 px-5 py-4 text-left">
            <p className="flex items-center gap-2 text-sm font-medium text-yellow-400">
              <ShieldAlert size={16} />
              Mercado Pago todavia no esta configurado.
            </p>
            <p className="mt-2 text-sm text-on_surface_variant">
              Hasta que se carguen la clave privada y la publica no se va a poder generar el cobro mensual.
            </p>
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-2xl border border-red-400/15 bg-red-400/5 px-5 py-4 text-sm text-red-400">
            {message}
          </div>
        )}

        <div className="grid gap-3">
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

          <LogoutButton />
        </div>

        <MercadoPagoCardModal
          open={Boolean(paymentSession)}
          title="Pagar mensualidad"
          subtitle="Completa el pago desde este bloqueo para volver a habilitar el panel."
          amount={Number(paymentSession?.amount || ownerBilling?.amount || 0)}
          currency={paymentSession?.currency || ownerBilling?.currency || 'ARS'}
          payerEmail={paymentSession?.payer?.email || user?.email || ''}
          allowPayerEmailEdit
          payerEmailHelpText="Si estas usando credenciales de prueba, carga el email de un comprador de prueba de Mercado Pago. No uses tu email real."
          submitLabel="mensualidad"
          onClose={() => setPaymentSession(null)}
          onSubmit={handleProcessPayment}
        />
      </div>
    </div>
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

function LogoutButton() {
  return (
    <button
      onClick={() => logout().then(() => { window.location.href = '/login'; })}
      className="flex items-center justify-center gap-2 w-full bg-surface_container border border-outline_variant/20 text-on_surface_variant py-3 rounded-2xl hover:bg-surface_container_highest transition-colors text-sm"
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
