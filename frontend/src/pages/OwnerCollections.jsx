import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  Unplug,
} from 'lucide-react';
import { fetchAPI } from '../services/api';

const PAYMENT_STATUS_LABEL = {
  UNPAID: 'Sin cobrar',
  PARTIAL: 'Parcial',
  PAID: 'Pagada',
};

const ORDER_STATUS_LABEL = {
  pending: 'Pendiente',
  completed: 'Completada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};

function formatMoney(value, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function MetricCard({ label, value, note, icon: Icon, tone = 'text-primary' }) {
  return (
    <div className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-5">
      <Icon size={18} className={`${tone} mb-2`} />
      <p className="text-xs uppercase tracking-wider text-outline mb-1">{label}</p>
      <p className="text-2xl font-display font-semibold text-on_surface">{value}</p>
      <p className="mt-2 text-sm text-on_surface_variant">{note}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-surface_container px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-widest text-outline mb-1">{label}</p>
      <p className="text-sm text-on_surface">{value || '-'}</p>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-outline_variant/10 bg-surface_container px-4 py-4 cursor-pointer">
      <div>
        <p className="text-sm font-medium text-on_surface">{label}</p>
        <p className="text-xs text-on_surface_variant mt-1">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-primary"
      />
    </label>
  );
}

export default function OwnerCollections() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [account, setAccount] = useState(null);
  const [complexes, setComplexes] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    reservationsEnabled: true,
    ordersEnabled: true,
  });

  const loadData = async (mode = 'initial') => {
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setErrorMessage('');

    try {
      const [paymentAccountResponse, reservationsResponse, ordersResponse] = await Promise.all([
        fetchAPI('/payment-account/current'),
        fetchAPI('/reservations'),
        fetchAPI('/orders'),
      ]);

      const nextAccount = paymentAccountResponse.account || null;
      setAccount(nextAccount);
      setComplexes(Array.isArray(paymentAccountResponse.complexes) ? paymentAccountResponse.complexes : []);
      setReservations(Array.isArray(reservationsResponse) ? reservationsResponse : []);
      setOrders(Array.isArray(ordersResponse) ? ordersResponse : []);
      setForm({
        reservationsEnabled: nextAccount?.reservationsEnabled ?? true,
        ordersEnabled: nextAccount?.ordersEnabled ?? true,
      });
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo cargar el panel de cobros.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const mpStatus = searchParams.get('mp');
    if (!mpStatus) return;

    if (mpStatus === 'connected') {
      setMessage('La cuenta de Mercado Pago quedó conectada correctamente.');
      loadData('refresh');
    } else if (mpStatus === 'error') {
      setErrorMessage(searchParams.get('message') || 'No se pudo conectar la cuenta de Mercado Pago.');
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const stats = useMemo(() => {
    const paidReservations = reservations.filter((reservation) => reservation.paymentStatus === 'PAID');
    const completedOrders = orders.filter((order) => order.status === 'completed');

    return {
      reservationsRevenue: paidReservations.reduce(
        (sum, reservation) => sum + Number(reservation.totalPrice || 0),
        0,
      ),
      paidReservations: paidReservations.length,
      unpaidReservations: reservations.filter((reservation) => reservation.paymentStatus !== 'PAID').length,
      ordersRevenue: completedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      completedOrders: completedOrders.length,
      pendingOrders: orders.filter((order) => order.status === 'pending').length,
    };
  }, [orders, reservations]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await fetchAPI('/payment-account/current', {
        method: 'PUT',
        body: JSON.stringify(form),
      });

      setAccount(response.account);
      setForm({
        reservationsEnabled: response.account?.reservationsEnabled ?? true,
        ordersEnabled: response.account?.ordersEnabled ?? true,
      });
      setMessage(response.message || 'Preferencias de cobro actualizadas.');
      await loadData('refresh');
    } catch (error) {
      setErrorMessage(error.message || 'No se pudieron guardar las preferencias de cobro.');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await fetchAPI('/payment-account/oauth/connect-url');
      if (!response.authorizationUrl) {
        throw new Error('No se pudo generar la autorizacion de Mercado Pago.');
      }

      window.location.assign(response.authorizationUrl);
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo iniciar la conexion con Mercado Pago.');
      setConnecting(false);
      return;
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await fetchAPI('/payment-account/current', {
        method: 'DELETE',
      });

      setAccount(response.account);
      setForm({
        reservationsEnabled: response.account?.reservationsEnabled ?? true,
        ordersEnabled: response.account?.ordersEnabled ?? true,
      });
      setMessage(response.message || 'La cuenta de Mercado Pago fue desvinculada.');
      await loadData('refresh');
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo desvincular la cuenta.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={38} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-sm uppercase tracking-widest text-outline">Cobros del complejo</p>
          <h2 className="text-[2rem] sm:text-[2.5rem] font-display font-medium text-on_surface tracking-tight">
            Reservas y tienda
          </h2>
          <p className="max-w-3xl text-on_surface_variant">
            Desde acá conectás tu cuenta de Mercado Pago para cobrar reservas y ventas de productos sin cargar credenciales de desarrollador.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData('refresh')}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-outline_variant/15 bg-surface_container px-4 py-3 text-sm text-on_surface_variant transition-colors hover:bg-surface_container_highest hover:text-on_surface disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {message && (
        <div className="mb-6 rounded-[1.5rem] border border-green-400/15 bg-green-400/5 px-5 py-4 text-sm text-green-400">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-[1.5rem] border border-red-400/15 bg-red-400/5 px-5 py-4 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Cuenta conectada"
          value={account?.providerConfigured ? 'Activa' : 'Pendiente'}
          note={account?.collectorEmail || 'Conecta tu cuenta para cobrar online.'}
          icon={CreditCard}
          tone={account?.providerConfigured ? 'text-green-400' : 'text-yellow-400'}
        />
        <MetricCard
          label="Reservas cobradas"
          value={stats.paidReservations}
          note={formatMoney(stats.reservationsRevenue)}
          icon={Ticket}
          tone="text-primary"
        />
        <MetricCard
          label="Pedidos cobrados"
          value={stats.completedOrders}
          note={formatMoney(stats.ordersRevenue)}
          icon={ShoppingBag}
          tone="text-green-400"
        />
        <MetricCard
          label="Cobros pendientes"
          value={stats.unpaidReservations + stats.pendingOrders}
          note={`${stats.unpaidReservations} reservas y ${stats.pendingOrders} pedidos`}
          icon={CheckCircle2}
          tone="text-yellow-400"
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.75rem] border border-outline_variant/10 bg-surface_container_low p-6 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Settings2 size={18} />
            </div>
            <div>
              <h3 className="text-xl font-display font-medium text-on_surface">Cuenta Mercado Pago</h3>
              <p className="text-sm text-on_surface_variant">
                El owner inicia sesión en Mercado Pago y autoriza el uso de su cuenta de cobro.
              </p>
            </div>
          </div>

          {!account?.secureStorageReady && (
            <div className="mb-5 rounded-2xl border border-yellow-400/15 bg-yellow-400/5 px-4 py-4 text-sm text-yellow-400">
              Falta <code>PAYMENT_ACCOUNT_ENCRYPTION_SECRET</code> en el backend. Sin esa variable no se puede guardar la vinculacion de la cuenta.
            </div>
          )}

          {account?.secureStorageReady && !account?.oauthReady && (
            <div className="mb-5 rounded-2xl border border-yellow-400/15 bg-yellow-400/5 px-4 py-4 text-sm text-yellow-400">
              Falta terminar la configuracion OAuth de Mercado Pago en el backend. Revisá <code>MERCADOPAGO_CLIENT_ID</code>, <code>MERCADOPAGO_CLIENT_SECRET</code>, <code>BACKEND_PUBLIC_URL</code> y <code>FRONTEND_URL</code>.
            </div>
          )}

          <div className="mb-5 rounded-2xl border border-outline_variant/10 bg-surface_container px-4 py-4">
            <p className="text-sm font-medium text-on_surface">
              {account?.providerConfigured
                ? 'La cuenta ya está vinculada y lista para cobrar.'
                : 'Todavía no hay una cuenta de Mercado Pago conectada.'}
            </p>
            <p className="mt-1 text-xs text-on_surface_variant">
              El flujo correcto es OAuth: el owner entra con su usuario de Mercado Pago y autoriza la conexión desde Mercado Pago.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || !account?.secureStorageReady || !account?.oauthReady}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-5 py-3.5 font-semibold text-on_primary_fixed transition-all hover:brightness-110 disabled:opacity-50"
            >
              {connecting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              {connecting
                ? 'Abriendo Mercado Pago...'
                : account?.providerConfigured
                  ? 'Reconectar cuenta'
                  : 'Conectar Mercado Pago'}
            </button>

            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting || !account?.providerConfigured}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-outline_variant/15 bg-surface_container px-5 py-3.5 font-semibold text-on_surface transition-colors hover:bg-surface_container_highest disabled:opacity-50"
            >
              {disconnecting ? <Loader2 size={18} className="animate-spin" /> : <Unplug size={18} />}
              {disconnecting ? 'Desvinculando...' : 'Desconectar cuenta'}
            </button>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSave}>
            <ToggleRow
              label="Cobrar reservas online"
              description="Si lo apagás, las reservas se siguen creando pero no se podrán cobrar por Mercado Pago."
              checked={form.reservationsEnabled}
              onChange={(checked) => setForm((prev) => ({ ...prev, reservationsEnabled: checked }))}
            />

            <ToggleRow
              label="Cobrar tienda online"
              description="Si lo apagás, el carrito de la tienda no abrirá checkout."
              checked={form.ordersEnabled}
              onChange={(checked) => setForm((prev) => ({ ...prev, ordersEnabled: checked }))}
            />

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-surface_container_highest px-5 py-3.5 font-semibold text-on_surface transition-colors hover:bg-surface disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'Guardando...' : 'Guardar preferencias de cobro'}
            </button>
          </form>
        </section>

        <section className="rounded-[1.75rem] border border-outline_variant/10 bg-surface_container_low p-6 sm:p-7">
          <h3 className="mb-5 text-xl font-display font-medium text-on_surface">Estado de la conexión</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MiniStat label="Estado" value={account?.status || 'DISCONNECTED'} />
            <MiniStat label="Modo" value={account?.mode || 'sandbox'} />
            <MiniStat label="Tipo de conexión" value={account?.authType === 'oauth' ? 'OAuth' : 'Manual'} />
            <MiniStat label="Collector ID" value={account?.collectorId || 'Sin validar'} />
            <MiniStat label="Nickname" value={account?.collectorNickname || 'Sin validar'} />
            <MiniStat label="Email cobrador" value={account?.collectorEmail || 'Sin validar'} />
            <MiniStat label="Última validación" value={formatDate(account?.lastValidatedAt)} />
            <MiniStat label="Token vigente hasta" value={formatDate(account?.tokenExpiresAt)} />
          </div>

          {account?.lastValidationError && (
            <div className="mt-5 rounded-2xl border border-yellow-400/15 bg-yellow-400/5 px-4 py-4">
              <p className="flex items-center gap-2 text-sm font-medium text-yellow-400">
                <ShieldAlert size={16} />
                Último problema informado por Mercado Pago
              </p>
              <p className="mt-2 text-sm text-on_surface_variant">{account.lastValidationError}</p>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-outline_variant/10 bg-surface_container p-4">
            <p className="text-xs uppercase tracking-widest text-outline mb-2">Complejos vinculados</p>
            <div className="flex flex-wrap gap-2">
              {complexes.length === 0 ? (
                <span className="text-sm text-on_surface_variant">No tenés complejos creados todavía.</span>
              ) : (
                complexes.map((complex) => (
                  <span
                    key={complex._id}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      complex.isActive ? 'bg-primary/10 text-primary' : 'bg-red-400/10 text-red-400'
                    }`}
                  >
                    {complex.name}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="rounded-[1.75rem] border border-outline_variant/10 bg-surface_container_high p-6 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-display font-medium text-on_surface">Cobros de reservas</h3>
              <p className="text-sm text-on_surface_variant">Historial de reservas y estado de cobro.</p>
            </div>
            <span className="text-xs uppercase tracking-widest text-outline">{reservations.length} reservas</span>
          </div>

          {reservations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline_variant/15 bg-surface_container_low px-5 py-8 text-center text-sm text-on_surface_variant">
              Todavía no hay reservas registradas.
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.slice(0, 8).map((reservation) => (
                <article key={reservation._id} className="rounded-2xl border border-outline_variant/10 bg-surface_container_low px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-on_surface">{reservation.user?.displayName || 'Cliente'}</p>
                      <p className="text-sm text-outline">{reservation.complexId?.name || 'Complejo'} · {reservation.court?.name || 'Cancha'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
                      <MiniStat label="Pago" value={PAYMENT_STATUS_LABEL[reservation.paymentStatus] || reservation.paymentStatus} />
                      <MiniStat label="Monto" value={formatMoney(reservation.totalPrice)} />
                      <MiniStat label="Fecha" value={formatDate(reservation.date)} />
                      <MiniStat label="MP" value={reservation.mercadoPagoStatus || 'Sin intento'} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-outline_variant/10 bg-surface_container_high p-6 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-display font-medium text-on_surface">Cobros de tienda</h3>
              <p className="text-sm text-on_surface_variant">Pedidos de la tienda y su estado de pago.</p>
            </div>
            <span className="text-xs uppercase tracking-widest text-outline">{orders.length} pedidos</span>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline_variant/15 bg-surface_container_low px-5 py-8 text-center text-sm text-on_surface_variant">
              Todavía no hay pedidos registrados.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 8).map((order) => (
                <article key={order._id} className="rounded-2xl border border-outline_variant/10 bg-surface_container_low px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-on_surface">{order.userId?.displayName || 'Cliente'}</p>
                      <p className="text-sm text-outline">{order.complexId?.name || 'Complejo'} · {order.items?.length || 0} item(s)</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
                      <MiniStat label="Estado" value={ORDER_STATUS_LABEL[order.status] || order.status} />
                      <MiniStat label="Monto" value={formatMoney(order.totalAmount)} />
                      <MiniStat label="Fecha" value={formatDate(order.createdAt)} />
                      <MiniStat label="MP" value={order.mercadoPagoStatus || 'Sin intento'} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
