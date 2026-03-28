import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  RefreshCcw,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAPI } from '../services/api';
import MercadoPagoCardModal from '../components/MercadoPagoCardModal';

const STATUS_META = {
  ACTIVE: {
    label: 'Activo',
    badgeClass: 'bg-green-400/10 text-green-400',
    panelClass: 'border-green-400/15 bg-green-400/5',
    icon: CheckCircle2,
  },
  GRACE: {
    label: 'Pago pendiente',
    badgeClass: 'bg-yellow-400/10 text-yellow-400',
    panelClass: 'border-yellow-400/15 bg-yellow-400/5',
    icon: AlertTriangle,
  },
  BLOCKED: {
    label: 'Bloqueado',
    badgeClass: 'bg-red-400/10 text-red-400',
    panelClass: 'border-red-400/15 bg-red-400/5',
    icon: ShieldAlert,
  },
  NOT_REQUIRED: {
    label: 'No requerido',
    badgeClass: 'bg-surface_container_highest text-on_surface_variant',
    panelClass: 'border-outline_variant/10 bg-surface_container_low',
    icon: CreditCard,
  },
};

const INVOICE_STATUS_META = {
  PAID: {
    label: 'Pagada',
    cls: 'bg-green-400/10 text-green-400',
  },
  PENDING: {
    label: 'Pendiente',
    cls: 'bg-yellow-400/10 text-yellow-400',
  },
  FAILED: {
    label: 'Fallida',
    cls: 'bg-red-400/10 text-red-400',
  },
  CANCELLED: {
    label: 'Cancelada',
    cls: 'bg-outline_variant/20 text-on_surface_variant',
  },
};

function formatMoney(amount, currency = 'ARS') {
  if (typeof amount !== 'number') return '-';

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return 'Sin fecha';

  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getStatusMessage(billing, pendingInvoice) {
  if (!billing) return 'Todavia no se pudo obtener tu estado de facturacion.';

  if (billing.status === 'ACTIVE') {
    const renewalHint = pendingInvoice?.dueDate
      ? `La proxima factura ya fue generada y vence el ${formatDate(pendingInvoice.dueDate)}.`
      : 'Tu proxima factura mensual se puede generar desde este panel.';

    return `Tu acceso al panel esta habilitado hasta el ${formatDate(billing.accessEndsAt)}. ${renewalHint}`;
  }

  if (billing.status === 'GRACE') {
    return `Tenes tiempo hasta el ${formatDate(billing.blockAt)} para pagar antes de que se bloquee el panel y tu complejo quede con acceso limitado.`;
  }

  if (billing.status === 'BLOCKED') {
    return 'El acceso al panel esta bloqueado por falta de pago. Hasta regularizarlo no vas a poder gestionar el complejo.';
  }

  return 'La facturacion mensual solo aplica a cuentas owner aprobadas.';
}

export default function OwnerBilling() {
  const { user, ownerBilling: sessionBilling, refreshProfile } = useAuth();
  const [billing, setBilling] = useState(sessionBilling);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [paymentSession, setPaymentSession] = useState(null);

  useEffect(() => {
    setBilling(sessionBilling);
  }, [sessionBilling]);

  useEffect(() => {
    let active = true;

    const loadBilling = async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const [currentBilling, invoices] = await Promise.all([
          fetchAPI('/owner-billing/current'),
          fetchAPI('/owner-billing/history'),
        ]);

        if (!active) return;

        setBilling(currentBilling);
        setHistory(Array.isArray(invoices) ? invoices : []);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error.message || 'No se pudo cargar la facturacion.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadBilling();

    return () => {
      active = false;
    };
  }, []);

  const pendingInvoice = useMemo(
    () => history.find((invoice) => invoice.status === 'PENDING') || null,
    [history],
  );

  const statusMeta = STATUS_META[billing?.status] || STATUS_META.NOT_REQUIRED;
  const StatusIcon = statusMeta.icon;
  const amountLabel = formatMoney(billing?.amount, billing?.currency);
  const statusMessage = getStatusMessage(billing, pendingInvoice);
  const invoiceForAction = pendingInvoice || billing?.currentInvoice || null;
  const primaryActionLabel = billing?.status === 'ACTIVE' ? 'Generar pago del proximo mes' : 'Pagar mensualidad';

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchAPI('/owner-billing/checkout', { method: 'POST' });

      if (response.ownerBilling) {
        setBilling(response.ownerBilling);
      }

      if (!response.paymentSession?.invoiceId) {
        throw new Error('No se pudo preparar la sesion de pago.');
      }

      setPaymentSession(response.paymentSession);
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo preparar el pago.');
      setCheckoutLoading(false);
      return;
    }

    setCheckoutLoading(false);
  };

  const handleProcessPayment = async (formData, additionalData) => {
    const invoiceId = paymentSession?.invoiceId || billing?.currentInvoice?.id;
    if (!invoiceId) {
      throw new Error('No hay una factura pendiente para cobrar.');
    }

    const response = await fetchAPI('/owner-billing/checkout/process-order', {
      method: 'POST',
      body: JSON.stringify({
        invoiceId,
        formData,
        additionalData,
      }),
    });

    await refreshProfile();

    const [currentBilling, invoices] = await Promise.all([
      fetchAPI('/owner-billing/current'),
      fetchAPI('/owner-billing/history'),
    ]);

    setBilling(currentBilling);
    setHistory(Array.isArray(invoices) ? invoices : []);
    setPaymentSession(null);
  };

  const handleRefresh = async () => {
    setRefreshLoading(true);
    setErrorMessage('');

    try {
      await refreshProfile();

      const [currentBilling, invoices] = await Promise.all([
        fetchAPI('/owner-billing/current'),
        fetchAPI('/owner-billing/history'),
      ]);

      setBilling(currentBilling);
      setHistory(Array.isArray(invoices) ? invoices : []);
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo actualizar el estado del pago.');
    } finally {
      setRefreshLoading(false);
    }
  };

  if (loading && !billing) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-8 sm:mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-outline uppercase tracking-widest mb-1">Mensualidad</p>
          <h2 className="text-[2rem] sm:text-[2.5rem] font-display font-medium text-on_surface tracking-tight">
            Mensualidad del complejo
          </h2>
          <p className="text-on_surface_variant max-w-3xl">
            Desde este panel gestionas el pago mensual de tu complejo. El cobro se realiza con Mercado Pago y se registra mes a mes, sin renovaciones automaticas.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={checkoutLoading || !billing?.providerConfigured}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold px-5 py-3 rounded-2xl shadow-[0_8px_30px_-10px_rgba(47,172,76,0.42)] hover:brightness-110 transition-all disabled:opacity-50"
          >
            {checkoutLoading ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
            {checkoutLoading ? 'Preparando pago...' : primaryActionLabel}
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-surface_container border border-outline_variant/15 text-on_surface_variant px-5 py-3 rounded-2xl hover:bg-surface_container_highest transition-colors disabled:opacity-50"
          >
            {refreshLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
            {refreshLoading ? 'Actualizando...' : 'Actualizar estado'}
          </button>
        </div>
      </header>

      {!billing?.providerConfigured && (
        <div className="mb-6 rounded-[1.5rem] border border-yellow-400/15 bg-yellow-400/5 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-medium text-yellow-400">
            <ShieldAlert size={16} />
            Mercado Pago no esta configurado.
          </p>
          <p className="mt-2 text-sm text-on_surface_variant">
            Hasta que se carguen la clave privada y la publica no se va a poder abrir el cobro mensual.
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-[1.5rem] border border-red-400/15 bg-red-400/5 px-5 py-4 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Estado"
          value={statusMeta.label}
          note={billing?.required ? 'Acceso al panel' : 'Facturacion no requerida'}
          badgeClass={statusMeta.badgeClass}
          icon={StatusIcon}
        />
        <MetricCard
          label="Mensualidad"
          value={amountLabel}
          note="Pago directo por Mercado Pago"
          badgeClass="bg-primary/10 text-primary"
          icon={CreditCard}
        />
        <MetricCard
          label="Acceso actual"
          value={billing?.accessEndsAt ? formatDate(billing.accessEndsAt) : 'Pendiente'}
          note="Cobertura de acceso"
          badgeClass="bg-surface_container_highest text-on_surface_variant"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Bloqueo o limite"
          value={billing?.blockAt ? formatDate(billing.blockAt) : 'Sin fecha'}
          note={`${billing?.graceDays || 0} dias de gracia maximo`}
          badgeClass="bg-yellow-400/10 text-yellow-400"
          icon={Clock3}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8 mb-8">
        <section className={`rounded-[1.75rem] border p-6 sm:p-7 ${statusMeta.panelClass}`}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${statusMeta.badgeClass}`}>
              <StatusIcon size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h3 className="text-xl font-display font-medium text-on_surface">Estado de la cuenta</h3>
                <span className={`text-[0.65rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-sm text-on_surface_variant">{statusMessage}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <InfoCard
              title="Ciclo mensual"
              rows={[
                { label: 'Frecuencia', value: '1 pago por mes' },
                { label: 'Dias de gracia', value: `${billing?.graceDays || 0} dias` },
                { label: 'Metodo', value: 'Mercado Pago directo' },
              ]}
            />
            <InfoCard
              title="Impacto operativo"
              rows={[
                { label: 'Panel de administracion', value: billing?.hasAccess ? 'Habilitado' : 'Bloqueado' },
                { label: 'Reservas del complejo', value: billing?.hasAccess ? 'Permitidas' : 'Bloqueadas' },
                { label: 'Compras del complejo', value: billing?.hasAccess ? 'Permitidas' : 'Bloqueadas' },
              ]}
            />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-outline_variant/10 bg-surface_container p-6 sm:p-7">
          <h3 className="text-xl font-display font-medium text-on_surface mb-5">Factura actual o proxima</h3>

          {invoiceForAction ? (
            <div className="space-y-4">
              <div className="rounded-[1.5rem] bg-surface_container_low px-5 py-4 space-y-3">
                <DetailRow label="Estado de factura" value={getInvoiceStatusLabel(invoiceForAction.status)} />
                <DetailRow label="Importe" value={formatMoney(invoiceForAction.amount, invoiceForAction.currency)} />
                <DetailRow label="Vencimiento" value={formatDate(invoiceForAction.dueDate)} />
                <DetailRow label="Pago acreditado" value={formatDate(invoiceForAction.paidAt)} />
                <DetailRow label="Estado MP" value={invoiceForAction.paymentStatus || invoiceForAction.mercadoPagoOrderStatus || 'Sin intento'} />
                <DetailRow label="Metodo" value={invoiceForAction.paymentMethodType || 'Tarjeta'} />
              </div>
            </div>
          ) : (
            <div className="rounded-[1.5rem] bg-surface_container_low px-5 py-6 text-sm text-on_surface_variant">
              Aun no hay una factura generada para mostrar. Podes crearla desde el boton de pago.
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[1.75rem] border border-outline_variant/10 bg-surface_container_high p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h3 className="text-xl font-display font-medium text-on_surface">Historial de pagos</h3>
            <p className="text-sm text-on_surface_variant">
              Cada mensualidad queda registrada con su vencimiento, cobro y estado final.
            </p>
          </div>
          <span className="text-xs uppercase tracking-widest text-outline">
            {history.length} movimiento{history.length !== 1 ? 's' : ''}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="rounded-[1.5rem] bg-surface_container_low px-5 py-6 text-sm text-on_surface_variant">
            Todavia no tenes pagos registrados.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((invoice) => {
              const invoiceMeta = INVOICE_STATUS_META[invoice.status] || INVOICE_STATUS_META.CANCELLED;

              return (
                <article
                  key={invoice.id}
                  className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low px-5 py-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <p className="font-medium text-on_surface">
                          {formatMoney(invoice.amount, invoice.currency)}
                        </p>
                        <span className={`text-[0.65rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${invoiceMeta.cls}`}>
                          {invoiceMeta.label}
                        </span>
                      </div>
                      <p className="text-sm text-on_surface_variant">
                        Creada el {formatDate(invoice.createdAt)}.
                        {invoice.paidAt ? ` Pagada el ${formatDate(invoice.paidAt)}.` : ''}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:min-w-[420px]">
                      <MiniStat label="Vence" value={formatDate(invoice.dueDate)} />
                      <MiniStat label="Acceso hasta" value={formatDate(invoice.accessEndsAt)} />
                      <MiniStat label="Grace hasta" value={formatDate(invoice.graceEndsAt)} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-on_surface_variant sm:grid-cols-3">
                    <div className="rounded-2xl bg-surface_container_highest px-4 py-3">
                      <p className="text-[0.65rem] uppercase tracking-widest text-outline mb-1">Orden MP</p>
                      <p className="text-on_surface">{invoice.mercadoPagoOrderId || 'Sin orden'}</p>
                    </div>
                    <div className="rounded-2xl bg-surface_container_highest px-4 py-3">
                      <p className="text-[0.65rem] uppercase tracking-widest text-outline mb-1">Estado MP</p>
                      <p className="text-on_surface">{invoice.paymentStatus || invoice.mercadoPagoOrderStatus || 'Sin intento'}</p>
                    </div>
                    <div className="rounded-2xl bg-surface_container_highest px-4 py-3">
                      <p className="text-[0.65rem] uppercase tracking-widest text-outline mb-1">Cobro</p>
                      <p className="text-on_surface">{invoice.paymentId || 'Sin pago'}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <MercadoPagoCardModal
        open={Boolean(paymentSession)}
        title="Completar mensualidad"

        amount={Number(paymentSession?.amount || billing?.amount || 0)}
        currency={paymentSession?.currency || billing?.currency || 'ARS'}
        payerEmail={paymentSession?.payer?.email || user?.email || ''}
        publicKey={paymentSession?.publicKey || ''}
        allowPayerEmailEdit={!paymentSession?.payer?.usesConfiguredTestEmail}
        payerEmailHelpText="Si estas usando credenciales de prueba, carga el email de un comprador de prueba de Mercado Pago. No uses tu email real."
        submitLabel="mensualidad"
        onClose={() => setPaymentSession(null)}
        onSubmit={handleProcessPayment}
      />
    </div>
  );
}

function MetricCard({ label, value, note, badgeClass, icon: Icon }) {
  return (
    <div className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-5">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 ${badgeClass}`}>
        <Icon size={18} />
      </div>
      <p className="text-xs text-outline uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-display font-semibold text-on_surface">{value}</p>
      <p className="text-sm text-on_surface_variant mt-2">{note}</p>
    </div>
  );
}

function InfoCard({ title, rows }) {
  return (
    <div className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low px-5 py-4">
      <h4 className="text-sm font-semibold text-on_surface mb-3">{title}</h4>
      <div className="space-y-3">
        {rows.map((row) => (
          <DetailRow key={`${title}-${row.label}`} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-outline">{label}</span>
      <span className="text-sm font-medium text-on_surface text-right">{value || '-'}</span>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-surface_container_highest px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-widest text-outline mb-1">{label}</p>
      <p className="text-sm text-on_surface">{value || '-'}</p>
    </div>
  );
}

function getInvoiceStatusLabel(status) {
  return INVOICE_STATUS_META[status]?.label || status || 'Sin estado';
}
