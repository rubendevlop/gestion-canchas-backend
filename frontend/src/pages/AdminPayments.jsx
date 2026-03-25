import { useEffect, useMemo, useState } from 'react';
import { fetchAPI } from '../services/api';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  ShoppingBag,
} from 'lucide-react';

const OWNER_STATUS_STYLE = {
  ACTIVE: { label: 'Al dia', cls: 'bg-green-400/10 text-green-400 border border-green-400/20' },
  GRACE: { label: 'En gracia', cls: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' },
  BLOCKED: { label: 'Bloqueado', cls: 'bg-red-400/10 text-red-400 border border-red-400/20' },
  NOT_REQUIRED: { label: 'No aplica', cls: 'bg-surface_container_highest text-on_surface_variant border border-outline_variant/10' },
};

const INVOICE_STATUS_STYLE = {
  PAID: { label: 'Pagada', cls: 'bg-green-400/10 text-green-400 border border-green-400/20' },
  PENDING: { label: 'Pendiente', cls: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' },
  FAILED: { label: 'Fallida', cls: 'bg-red-400/10 text-red-400 border border-red-400/20' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-surface_container_highest text-on_surface_variant border border-outline_variant/10' },
};

const RESERVATION_PAYMENT_STYLE = {
  UNPAID: { label: 'Sin cobrar', cls: 'bg-red-400/10 text-red-400 border border-red-400/20' },
  PARTIAL: { label: 'Parcial', cls: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' },
  PAID: { label: 'Pagada', cls: 'bg-green-400/10 text-green-400 border border-green-400/20' },
};

const ORDER_STATUS_STYLE = {
  pending: { label: 'Pendiente', cls: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' },
  completed: { label: 'Completada', cls: 'bg-green-400/10 text-green-400 border border-green-400/20' },
  failed: { label: 'Fallida', cls: 'bg-red-400/10 text-red-400 border border-red-400/20' },
  cancelled: { label: 'Cancelada', cls: 'bg-surface_container_highest text-on_surface_variant border border-outline_variant/10' },
};

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value, currency = 'ARS') {
  if (typeof value !== 'number') return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AdminPayments() {
  const [owners, setOwners] = useState([]);
  const [ownerInvoices, setOwnerInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('owner');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadData = async () => {
    setLoading(true);

    try {
      const [ownersData, invoicesData, ordersData, reservationsData] = await Promise.all([
        fetchAPI('/users/directory?role=owner'),
        fetchAPI('/owner-billing/admin/invoices'),
        fetchAPI('/orders'),
        fetchAPI('/reservations'),
      ]);

      setOwners(Array.isArray(ownersData) ? ownersData : []);
      setOwnerInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setReservations(Array.isArray(reservationsData) ? reservationsData : []);
    } catch {
      setOwners([]);
      setOwnerInvoices([]);
      setOrders([]);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const ownerStats = useMemo(() => ({
    active: owners.filter((owner) => owner.ownerBilling?.status === 'ACTIVE').length,
    grace: owners.filter((owner) => owner.ownerBilling?.status === 'GRACE').length,
    blocked: owners.filter((owner) => owner.ownerBilling?.status === 'BLOCKED').length,
    pendingInvoices: ownerInvoices.filter((invoice) => invoice.status === 'PENDING').length,
    completedOrdersAmount: orders
      .filter((order) => order.status === 'completed')
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    paidReservations: reservations.filter((reservation) => reservation.paymentStatus === 'PAID').length,
  }), [orders, ownerInvoices, owners, reservations]);

  const ownersRequiringAttention = useMemo(
    () => owners.filter((owner) => ['GRACE', 'BLOCKED'].includes(owner.ownerBilling?.status)),
    [owners],
  );

  const filteredOwners = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return owners.filter((owner) => {
      if (statusFilter !== 'ALL' && owner.ownerBilling?.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        owner.displayName,
        owner.email,
        owner.ownerBilling?.status,
        ...(owner.complexes || []).map((complex) => complex.name),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });
  }, [owners, search, statusFilter]);

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return ownerInvoices.filter((invoice) => {
      if (statusFilter !== 'ALL' && invoice.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        invoice.owner?.displayName,
        invoice.owner?.email,
        invoice.status,
        invoice.paymentStatus,
        ...(invoice.complexes || []).map((complex) => complex.name),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });
  }, [ownerInvoices, search, statusFilter]);

  const filteredReservations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return reservations.filter((reservation) => {
      if (statusFilter !== 'ALL' && reservation.paymentStatus !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        reservation.user?.displayName,
        reservation.user?.email,
        reservation.court?.name,
        reservation.complexId?.name,
        reservation.paymentStatus,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });
  }, [reservations, search, statusFilter]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        order.userId?.displayName,
        order.userId?.email,
        order.complexId?.name,
        order.status,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-8 lg:mb-10">
        <h2 className="text-[2rem] sm:text-[2.5rem] font-display font-medium text-on_surface tracking-tight mb-1">
          Pagos y cobranzas
        </h2>
        <p className="text-on_surface_variant">
          Seguimiento de mensualidades owner y estados de cobro del resto de la plataforma.
        </p>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4 mb-8">
        <MetricCard label="Owners al dia" value={ownerStats.active} icon={CheckCircle2} color="text-green-400" />
        <MetricCard label="En gracia" value={ownerStats.grace} icon={Clock3} color="text-yellow-400" />
        <MetricCard label="Bloqueados" value={ownerStats.blocked} icon={AlertTriangle} color="text-red-400" />
        <MetricCard label="Mensualidades pendientes" value={ownerStats.pendingInvoices} icon={CreditCard} color="text-primary" />
        <MetricCard label="Pedidos cobrados" value={formatMoney(ownerStats.completedOrdersAmount)} icon={ShoppingBag} color="text-green-400" />
        <MetricCard label="Reservas pagadas" value={ownerStats.paidReservations} icon={CalendarRange} color="text-on_surface" />
      </div>

      <section className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low p-5 sm:p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div>
            <h3 className="text-xl font-display font-medium text-on_surface">Owners con seguimiento</h3>
            <p className="text-sm text-on_surface_variant">
              Cuentas owner que deben pagar o ya estan bloqueadas.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="self-start lg:self-auto inline-flex items-center gap-2 rounded-2xl border border-outline_variant/15 bg-surface_container px-4 py-2.5 text-sm text-on_surface_variant hover:text-on_surface hover:bg-surface_container_highest transition-colors"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={30} />
          </div>
        ) : ownersRequiringAttention.length === 0 ? (
          <div className="rounded-2xl bg-green-400/5 border border-green-400/15 px-5 py-6 text-sm text-green-400">
            No hay owners con pagos atrasados en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {ownersRequiringAttention.map((owner) => {
              const billingMeta = OWNER_STATUS_STYLE[owner.ownerBilling?.status] || OWNER_STATUS_STYLE.NOT_REQUIRED;

              return (
                <article key={owner._id} className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-on_surface truncate">{owner.displayName}</p>
                      <p className="text-sm text-outline break-all">{owner.email}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${billingMeta.cls}`}>
                          {billingMeta.label}
                        </span>
                        <span className="text-xs px-3 py-1 rounded-full font-semibold bg-primary/10 text-primary">
                          {formatMoney(owner.ownerBilling?.amount, owner.ownerBilling?.currency)}
                        </span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right text-sm text-on_surface_variant">
                      <p>Bloqueo: {formatDate(owner.ownerBilling?.blockAt)}</p>
                      <p>Acceso hasta: {formatDate(owner.ownerBilling?.accessEndsAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {(owner.complexes || []).map((complex) => (
                      <span
                        key={complex._id}
                        className={`text-xs px-3 py-1 rounded-full ${
                          complex.isActive ? 'bg-primary/10 text-primary' : 'bg-red-400/10 text-red-400'
                        }`}
                      >
                        {complex.name}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-outline_variant/10 pb-2">
        {[
          { id: 'owner', label: 'Mensualidades owner' },
          { id: 'reservations', label: 'Reservas' },
          { id: 'orders', label: 'Tienda' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setSearch('');
              setStatusFilter('ALL');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-all ${
              tab === item.id ? 'text-primary border-b-2 border-primary' : 'text-outline hover:text-on_surface'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_high overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-outline_variant/10 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
            <input
              type="text"
              placeholder="Buscar por usuario, email, complejo o estado..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-surface_container border border-outline_variant/15 rounded-xl py-2.5 pl-9 pr-4 text-sm text-on_surface placeholder-outline focus:outline-none focus:border-primary/40 transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bg-surface_container border border-outline_variant/15 rounded-xl py-2.5 px-4 text-sm text-on_surface focus:outline-none focus:border-primary/40 transition-all"
          >
            {tab === 'owner' && (
              <>
                <option value="ALL">Todos los estados</option>
                <option value="ACTIVE">Owners al dia</option>
                <option value="GRACE">En gracia</option>
                <option value="BLOCKED">Bloqueados</option>
                <option value="PENDING">Facturas pendientes</option>
                <option value="PAID">Facturas pagadas</option>
                <option value="FAILED">Facturas fallidas</option>
                <option value="CANCELLED">Facturas canceladas</option>
              </>
            )}
            {tab === 'reservations' && (
              <>
                <option value="ALL">Todos los cobros</option>
                <option value="UNPAID">Sin cobrar</option>
                <option value="PARTIAL">Parcial</option>
                <option value="PAID">Pagada</option>
              </>
            )}
            {tab === 'orders' && (
              <>
                <option value="ALL">Todos los pedidos</option>
                <option value="pending">Pendiente</option>
                <option value="completed">Completada</option>
                <option value="failed">Fallida</option>
                <option value="cancelled">Cancelada</option>
              </>
            )}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="animate-spin text-primary" size={34} />
          </div>
        ) : tab === 'owner' ? (
          <div className="p-4 sm:p-6 space-y-6">
            <div>
              <h3 className="text-lg font-display font-medium text-on_surface mb-3">Estado actual de owners</h3>
              {filteredOwners.length === 0 ? (
                <EmptyState message="No hay owners que coincidan con esos filtros." />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredOwners.map((owner) => {
                    const billingMeta = OWNER_STATUS_STYLE[owner.ownerBilling?.status] || OWNER_STATUS_STYLE.NOT_REQUIRED;
                    return (
                      <article key={owner._id} className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-on_surface truncate">{owner.displayName}</p>
                            <p className="text-sm text-outline break-all">{owner.email}</p>
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${billingMeta.cls}`}>
                            {billingMeta.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <MiniStat label="Mensualidad" value={formatMoney(owner.ownerBilling?.amount, owner.ownerBilling?.currency)} />
                          <MiniStat label="Bloqueo" value={formatDate(owner.ownerBilling?.blockAt)} />
                          <MiniStat label="Acceso" value={formatDate(owner.ownerBilling?.accessEndsAt)} />
                          <MiniStat label="Complejos" value={owner.complexes?.length || 0} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-display font-medium text-on_surface mb-3">Historial de mensualidades</h3>
              {filteredInvoices.length === 0 ? (
                <EmptyState message="No hay facturas owner que coincidan con esos filtros." />
              ) : (
                <div className="space-y-3">
                  {filteredInvoices.map((invoice) => {
                    const invoiceMeta = INVOICE_STATUS_STYLE[invoice.status] || INVOICE_STATUS_STYLE.CANCELLED;
                    return (
                      <article key={invoice.id} className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low p-5">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <p className="font-semibold text-on_surface">{invoice.owner?.displayName || 'Owner'}</p>
                              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${invoiceMeta.cls}`}>
                                {invoiceMeta.label}
                              </span>
                            </div>
                            <p className="text-sm text-outline break-all">{invoice.owner?.email}</p>
                            <p className="text-sm text-on_surface_variant mt-2">
                              {invoice.complexes?.map((complex) => complex.name).join(' · ') || 'Sin complejo'}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:min-w-[520px]">
                            <MiniStat label="Importe" value={formatMoney(invoice.amount, invoice.currency)} />
                            <MiniStat label="Vence" value={formatDate(invoice.dueDate)} />
                            <MiniStat label="Pago" value={formatDate(invoice.paidAt)} />
                            <MiniStat label="Creada" value={formatDate(invoice.createdAt)} />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : tab === 'reservations' ? (
          <div className="p-4 sm:p-6 space-y-3">
            {filteredReservations.length === 0 ? (
              <EmptyState message="No hay reservas con esos filtros." />
            ) : (
              filteredReservations.map((reservation) => {
                const paymentMeta = RESERVATION_PAYMENT_STYLE[reservation.paymentStatus] || RESERVATION_PAYMENT_STYLE.UNPAID;
                return (
                  <article key={reservation._id} className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <p className="font-semibold text-on_surface">{reservation.user?.displayName || 'Cliente'}</p>
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${paymentMeta.cls}`}>
                            {paymentMeta.label}
                          </span>
                        </div>
                        <p className="text-sm text-outline break-all">{reservation.user?.email || 'Sin email'}</p>
                        <p className="text-sm text-on_surface_variant mt-2">
                          {reservation.complexId?.name || 'Complejo'} · {reservation.court?.name || 'Cancha'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:min-w-[520px]">
                        <MiniStat label="Fecha" value={formatDate(reservation.date)} />
                        <MiniStat label="Horario" value={`${reservation.startTime} - ${reservation.endTime}`} />
                        <MiniStat label="Estado" value={reservation.status} />
                        <MiniStat label="Importe" value={formatMoney(Number(reservation.totalPrice || 0))} />
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-3">
            {filteredOrders.length === 0 ? (
              <EmptyState message="No hay pedidos con esos filtros." />
            ) : (
              filteredOrders.map((order) => {
                const orderMeta = ORDER_STATUS_STYLE[order.status] || ORDER_STATUS_STYLE.pending;
                return (
                  <article key={order._id} className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <p className="font-semibold text-on_surface">{order.userId?.displayName || 'Usuario'}</p>
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${orderMeta.cls}`}>
                            {orderMeta.label}
                          </span>
                        </div>
                        <p className="text-sm text-outline break-all">{order.userId?.email || 'Sin email'}</p>
                        <p className="text-sm text-on_surface_variant mt-2">
                          {order.complexId?.name || 'Sin complejo'} · {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:min-w-[520px]">
                        <MiniStat label="Monto" value={formatMoney(Number(order.totalAmount || 0))} />
                        <MiniStat label="Estado" value={order.status} />
                        <MiniStat label="Creado" value={formatDateTime(order.createdAt)} />
                        <MiniStat label="Complejo" value={order.complexId?.name || 'N/A'} />
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-5">
      <Icon size={18} className={`${color} mb-2 opacity-70`} />
      <p className="text-xs text-outline uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-2xl font-display font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-surface_container px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-widest text-outline mb-1">{label}</p>
      <p className="text-sm text-on_surface">{value}</p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-outline_variant/15 bg-surface_container_low px-5 py-8 text-center text-sm text-on_surface_variant">
      {message}
    </div>
  );
}
