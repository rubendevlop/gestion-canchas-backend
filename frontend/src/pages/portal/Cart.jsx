import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ChevronLeft, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import MercadoPagoCardModal from '../../components/MercadoPagoCardModal';
import { useAuth } from '../../contexts/AuthContext';
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
  const { user } = useAuth();

  const { cart = {}, products = [] } = state || {};
  const [localCart, setLocalCart] = useState(cart);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [draftOrder, setDraftOrder] = useState(null);
  const [paymentSession, setPaymentSession] = useState(null);

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

      setDraftOrder(response.order);
      setPaymentSession(response.paymentSession);
    } catch (error) {
      setMessage(error.message || 'Error al preparar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayOrder = async (formData, additionalData) => {
    const orderId = paymentSession?.orderId || draftOrder?._id;
    if (!orderId) {
      throw new Error('No hay un pedido listo para cobrar.');
    }

    const response = await fetchAPI(`/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ formData, additionalData }),
    });

    setDraftOrder(response.order);
    setPaymentSession(null);

    if (response.order?.status === 'completed') {
      setSuccess(true);
      setMessage('El pedido ya fue cobrado y confirmado.');
      setTimeout(() => navigate('/portal'), 2200);
      return;
    }

    setMessage('El pedido fue creado. Si el cobro queda pendiente, podras verlo luego en el historial del complejo.');
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <CheckCircle2 size={72} className="text-green-400 mb-6" />
        <h2 className="text-3xl font-display font-bold text-white mb-2">Pedido pagado</h2>
        <p className="text-white/40">Redirigiendo al inicio...</p>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="text-center py-32">
        <p className="text-5xl mb-4">Carrito vacio</p>
        <p className="text-white/40 text-lg">No hay productos pendientes para cobrar.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors"
      >
        <ChevronLeft size={16} />
        Seguir comprando
      </button>
      <h1 className="text-3xl font-display font-bold text-white mb-8">Tu carrito</h1>

      {message && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
          {message}
        </div>
      )}

      <div className="space-y-3 mb-8">
        {cartItems.map((product) => (
          <div
            key={product._id}
            className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-5 py-4"
          >
            <div>
              <p className="text-white font-medium text-sm">{product.name}</p>
              <p className="text-white/40 text-xs mt-0.5">
                x{localCart[product._id]} unidad{localCart[product._id] > 1 ? 'es' : ''}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-primary font-semibold">{formatMoney(product.price * localCart[product._id])}</p>
              <button
                onClick={() => remove(product._id)}
                className="text-white/20 hover:text-error transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex justify-between text-base font-semibold text-white mb-5">
          <span>Total</span>
          <span className="text-primary text-xl">{formatMoney(total)}</span>
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-bold py-4 rounded-2xl hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          {loading ? 'Preparando pago...' : 'Pagar pedido'}
        </button>

        {draftOrder && (
          <div className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/60">
            Pedido local: <span className="text-white">{draftOrder._id}</span>
          </div>
        )}
      </div>

      <MercadoPagoCardModal
        open={Boolean(paymentSession)}
        title="Pagar pedido del ecommerce"
        subtitle="El cobro se procesa con Mercado Pago Orders API y queda vinculado al complejo correspondiente."
        amount={Number(paymentSession?.amount || total)}
        currency={paymentSession?.currency || 'ARS'}
        payerEmail={paymentSession?.payer?.email || user?.email || ''}
        publicKey={paymentSession?.publicKey || ''}
        allowPayerEmailEdit
        payerEmailHelpText="Si estas probando en sandbox, usa el email de un comprador de prueba de Mercado Pago."
        submitLabel="pedido"
        maxInstallments={3}
        onClose={() => setPaymentSession(null)}
        onSubmit={handlePayOrder}
      />
    </div>
  );
}
