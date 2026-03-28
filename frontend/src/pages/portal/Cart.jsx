import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ChevronLeft, CheckCircle2, Loader2, MapPin, Trash2 } from 'lucide-react';
import { fetchAPI } from '../../services/api';

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function Cart() {
  const { complexId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const { cart = {}, products = [] } = state || {};
  const [localCart, setLocalCart] = useState(cart);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');

  const cartItems = useMemo(() => products.filter((product) => localCart[product._id]), [localCart, products]);
  const total = cartItems.reduce((sum, product) => sum + product.price * (localCart[product._id] || 0), 0);

  const remove = (id) =>
    setLocalCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const handleCheckout = async () => {
    setLoading(true);
    setMessage('');

    try {
      const items = cartItems.map((product) => ({
        productId: product._id,
        quantity: localCart[product._id],
      }));

      const response = await fetchAPI('/orders', {
        method: 'POST',
        body: JSON.stringify({ complexId, items }),
      });

      if (!response.providerConfigured || !response.paymentSession?.orderId) {
        throw new Error('Mercado Pago no esta configurado para cobrar este pedido.');
      }

      if (!response.paymentSession?.checkoutUrl) {
        throw new Error('No se pudo generar el checkout de Mercado Pago.');
      }

      window.location.assign(response.paymentSession.checkoutUrl);
      return;
    } catch (error) {
      setMessage(error.message || 'Error al preparar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <CheckCircle2 size={72} className="mb-6 text-green-500" />
        <h2 className="mb-2 font-display text-3xl font-bold text-on_surface">Pedido pagado</h2>
        <p className="text-on_surface_variant">Redirigiendo al inicio...</p>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="py-32 text-center">
        <p className="mb-4 text-5xl text-on_surface_variant/40">Carrito vacio</p>
        <p className="text-lg text-on_surface_variant">No hay productos pendientes para cobrar.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center gap-2 text-sm text-on_surface_variant transition-colors hover:text-on_surface"
      >
        <ChevronLeft size={16} />
        Seguir comprando
      </button>
      <h1 className="mb-8 font-display text-3xl font-bold text-on_surface">Tu carrito</h1>

      {message && (
        <div className="mb-6 rounded-2xl border border-outline_variant/20 bg-surface_container_low px-5 py-4 text-sm text-on_surface_variant">
          {message}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/10 px-5 py-4">
        <p className="flex items-start gap-3 text-sm text-on_surface">
          <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
          Estos productos se retiran en el complejo donde los compraste. No se realizan envios ni delivery.
        </p>
      </div>

      <div className="mb-8 space-y-3">
        {cartItems.map((product) => (
          <div
            key={product._id}
            className="flex items-center justify-between rounded-2xl border border-outline_variant/20 bg-white px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-on_surface">{product.name}</p>
              <p className="mt-0.5 text-xs text-on_surface_variant">
                x{localCart[product._id]} unidad{localCart[product._id] > 1 ? 'es' : ''}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <p className="font-semibold text-primary">{formatMoney(product.price * localCart[product._id])}</p>
              <button
                onClick={() => remove(product._id)}
                className="text-outline transition-colors hover:text-error"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-outline_variant/20 bg-white p-6 shadow-[0_18px_38px_-26px_rgba(24,36,24,0.18)]">
        <div className="mb-5 flex justify-between text-base font-semibold text-on_surface">
          <span>Total</span>
          <span className="text-xl text-primary">{formatMoney(total)}</span>
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary py-4 font-bold text-on_primary transition-all hover:brightness-110 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          {loading ? 'Preparando pago...' : 'Pagar pedido'}
        </button>
      </div>
    </div>
  );
}
