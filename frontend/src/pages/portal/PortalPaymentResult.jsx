import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import { fetchAPI } from '../../services/api';

function resolveNextPath(entity, complexId, status) {
  if (entity === 'reservation') {
    if (status === 'success' || status === 'pending') {
      return '/portal/mis-reservas';
    }
    return complexId ? `/portal/complejo/${complexId}/reservar` : '/portal';
  }

  if (entity === 'order') {
    if (status === 'failure' && complexId) {
      return `/portal/complejo/${complexId}/tienda`;
    }
    return '/portal/mis-compras';
  }

  return '/portal';
}

function resolveVisualState(entity, payload) {
  if (entity === 'reservation') {
    if (payload?.reservation?.paymentStatus === 'PAID') {
      return {
        tone: 'success',
        title: 'Pago acreditado',
        description: 'La reserva quedo confirmada correctamente.',
      };
    }

    if (payload?.reservation?.status === 'CANCELLED') {
      return {
        tone: 'failure',
        title: 'Reserva cancelada',
        description: 'Mercado Pago no confirmo el pago y el horario se libero.',
      };
    }

    return {
      tone: 'pending',
      title: 'Pago pendiente',
      description: 'La reserva sigue pendiente hasta que Mercado Pago confirme la acreditacion.',
    };
  }

  if (entity === 'order') {
    if (payload?.order?.status === 'completed') {
      return {
        tone: 'success',
        title: 'Pago acreditado',
        description: 'El pedido fue confirmado correctamente.',
      };
    }

    if (['failed', 'cancelled'].includes(String(payload?.order?.status || ''))) {
      return {
        tone: 'failure',
        title: 'Pago no acreditado',
        description: 'El pedido no pudo confirmarse con Mercado Pago.',
      };
    }

    return {
      tone: 'pending',
      title: 'Pago pendiente',
      description: 'El pedido sigue pendiente hasta que Mercado Pago confirme la acreditacion.',
    };
  }

  return {
    tone: 'failure',
    title: 'Retorno invalido',
    description: 'No se pudo determinar el resultado del pago.',
  };
}

export default function PortalPaymentResult() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState(null);

  const entity = searchParams.get('entity') || '';
  const entityId = searchParams.get('id') || '';
  const complexId = searchParams.get('complexId') || '';
  const resultHint = (searchParams.get('result') || searchParams.get('status') || searchParams.get('collection_status') || 'pending').toLowerCase();
  const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id') || '';

  const visualState = useMemo(() => resolveVisualState(entity, payload), [entity, payload]);
  const nextPath = useMemo(
    () => resolveNextPath(entity, complexId, visualState.tone === 'failure' ? 'failure' : resultHint),
    [complexId, entity, resultHint, visualState.tone],
  );

  useEffect(() => {
    let active = true;

    const syncPayment = async () => {
      if (!entity || !entityId) {
        if (!active) return;
        setErrorMessage('No se recibio informacion suficiente para validar el pago.');
        setLoading(false);
        return;
      }

      try {
        const endpoint =
          entity === 'reservation'
            ? `/reservations/${entityId}/sync-payment`
            : entity === 'order'
              ? `/orders/${entityId}/sync-payment`
              : '';

        if (!endpoint) {
          throw new Error('Tipo de pago no soportado.');
        }

        const response = await fetchAPI(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            paymentId,
            result: resultHint,
          }),
        });

        if (!active) return;
        setPayload(response);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error.message || 'No se pudo validar el resultado del pago.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    syncPayment();

    return () => {
      active = false;
    };
  }, [entity, entityId, paymentId, resultHint]);

  useEffect(() => {
    if (loading || errorMessage || visualState.tone === 'failure') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      navigate(nextPath, { replace: true });
    }, visualState.tone === 'success' ? 2200 : 2800);

    return () => window.clearTimeout(timeoutId);
  }, [errorMessage, loading, navigate, nextPath, visualState.tone]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Loader2 size={42} className="animate-spin text-primary" />
        <h1 className="mt-6 text-3xl font-display font-bold text-on_surface">Validando pago</h1>
        <p className="mt-2 text-on_surface_variant">Estamos consultando a Mercado Pago para confirmar el estado.</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-red-400/20 bg-white p-8 text-center shadow-[0_24px_60px_-34px_rgba(24,36,24,0.18)]">
        <AlertCircle size={52} className="mx-auto text-red-500" />
        <h1 className="mt-5 text-3xl font-display font-bold text-on_surface">No se pudo validar el pago</h1>
        <p className="mt-3 text-on_surface_variant">{errorMessage}</p>
        <button
          type="button"
          onClick={() => navigate(nextPath, { replace: true })}
          className="mt-8 rounded-2xl bg-primary px-6 py-3 font-semibold text-on_primary"
        >
          Volver
        </button>
      </div>
    );
  }

  const Icon = visualState.tone === 'success'
    ? CheckCircle2
    : visualState.tone === 'pending'
      ? Clock3
      : AlertCircle;

  return (
    <div className="mx-auto max-w-2xl rounded-[2rem] border border-outline_variant/20 bg-white p-8 text-center shadow-[0_24px_60px_-34px_rgba(24,36,24,0.18)]">
      <Icon size={56} className={`mx-auto ${visualState.tone === 'success' ? 'text-primary' : visualState.tone === 'pending' ? 'text-yellow-500' : 'text-red-500'}`} />
      <h1 className="mt-5 text-3xl font-display font-bold text-on_surface">{visualState.title}</h1>
      <p className="mt-3 text-on_surface_variant">{visualState.description}</p>
      <button
        type="button"
        onClick={() => navigate(nextPath, { replace: true })}
        className="mt-8 rounded-2xl bg-primary px-6 py-3 font-semibold text-on_primary"
      >
        Continuar
      </button>
    </div>
  );
}
