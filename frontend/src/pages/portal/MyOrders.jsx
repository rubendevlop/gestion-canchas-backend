import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MapPin, Package, ShoppingBag, Store } from 'lucide-react';
import { fetchAPI } from '../../services/api';

const STATUS_STYLES = {
  completed: { label: 'Pagado', cls: 'bg-green-400/10 text-green-600' },
  pending: { label: 'Pendiente', cls: 'bg-yellow-400/10 text-yellow-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-400/10 text-red-600' },
  failed: { label: 'Fallido', cls: 'bg-red-400/10 text-red-600' },
};

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`;
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI('/orders')
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const { completedOrders, otherOrders } = useMemo(
    () => ({
      completedOrders: orders.filter((order) => order.status === 'completed'),
      otherOrders: orders.filter((order) => order.status !== 'completed'),
    }),
    [orders],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-24 text-center">
        <ShoppingBag size={56} className="mx-auto mb-4 text-on_surface_variant/25" strokeWidth={1} />
        <p className="mb-6 text-on_surface_variant">Todavia no tienes compras registradas.</p>
        <Link
          to="/portal"
          className="rounded-2xl bg-primary/10 px-6 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/15"
        >
          Ir a los complejos
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-on_surface">Mis compras</h1>
        <p className="mt-2 text-on_surface_variant">
          Revisa que compraste, en que complejo y como quedo cada pedido.
        </p>
      </header>

      <div className="mb-8 rounded-2xl border border-primary/15 bg-primary/10 px-5 py-4">
        <p className="flex items-start gap-3 text-sm text-on_surface">
          <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
          Recuerda que cada compra se retira en el complejo donde fue realizada. La app no gestiona entregas a domicilio.
        </p>
      </div>

      <div className="space-y-10">
        {completedOrders.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-on_surface_variant">
              Compras confirmadas
            </h2>
            <div className="space-y-4">
              {completedOrders.map((order) => (
                <OrderCard key={order._id} order={order} />
              ))}
            </div>
          </section>
        )}

        {otherOrders.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-on_surface_variant">
              Otros pedidos
            </h2>
            <div className="space-y-4">
              {otherOrders.map((order) => (
                <OrderCard key={order._id} order={order} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order }) {
  const status = STATUS_STYLES[String(order.status || '').toLowerCase()] || STATUS_STYLES.pending;
  const complex = order.complexId;
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <article className="rounded-[2rem] border border-outline_variant/20 bg-white p-6 shadow-[0_20px_44px_-34px_rgba(24,36,24,0.2)]">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${status.cls}`}>
              {status.label}
            </span>
            <span className="rounded-full bg-surface_container px-3 py-1 text-xs font-semibold uppercase tracking-wider text-on_surface_variant">
              Pedido #{String(order._id).slice(-6).toUpperCase()}
            </span>
          </div>

          <h2 className="text-xl font-display font-semibold text-on_surface">
            {complex?.name || 'Complejo'}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-on_surface_variant">
            <Store size={14} />
            Comprado en {complex?.name || 'un complejo'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface_container_low p-4 text-sm sm:min-w-[240px]">
          <Metric label="Total" value={formatMoney(order.totalAmount)} strong />
          <Metric label="Creado" value={formatDate(order.createdAt)} />
          <Metric label="Pagado" value={formatDate(order.paidAt)} />
          <Metric label="Items" value={String(items.length)} />
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.productId?._id || item.productId || index}`}
            className="flex flex-col gap-3 rounded-2xl border border-outline_variant/15 bg-surface_container_low px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Package size={18} />
              </div>
              <div>
                <p className="font-medium text-on_surface">
                  {item.productId?.name || 'Producto'}
                </p>
                <p className="text-sm text-on_surface_variant">
                  Cantidad: {Number(item.quantity || 1)}
                </p>
              </div>
            </div>

            <div className="text-sm font-semibold text-on_surface">
              {formatMoney(Number(item.price || 0) * Number(item.quantity || 1))}
            </div>
          </div>
        ))}
      </div>

      {complex?._id && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="rounded-2xl border border-outline_variant/15 bg-surface_container_low px-4 py-3 text-sm text-on_surface_variant">
            Entrega y retiro en <span className="font-semibold text-on_surface">{complex?.name || 'el complejo'}</span>.
          </p>
          <Link
            to={`/portal/complejo/${complex._id}/tienda`}
            className="inline-flex items-center gap-2 rounded-2xl border border-outline_variant/20 px-4 py-3 text-sm font-medium text-on_surface transition-colors hover:bg-surface_container_low"
          >
            <ShoppingBag size={16} />
            Volver a esta tienda
          </Link>
        </div>
      )}
    </article>
  );
}

function Metric({ label, value, strong = false }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-outline">{label}</p>
      <p className={`mt-1 ${strong ? 'font-semibold text-on_surface' : 'text-on_surface_variant'}`}>
        {value}
      </p>
    </div>
  );
}
