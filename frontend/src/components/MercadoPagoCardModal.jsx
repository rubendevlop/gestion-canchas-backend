import { useEffect, useMemo, useState } from 'react';
import { CardPayment } from '@mercadopago/sdk-react';
import { CreditCard, Loader2, X } from 'lucide-react';
import { ensureMercadoPago, getMercadoPagoPublicKey, isMercadoPagoConfigured } from '../lib/mercadoPago';

function formatMoney(amount, currency = 'ARS') {
  if (typeof amount !== 'number') return '-';

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function MercadoPagoCardModal({
  open,
  title,
  subtitle,
  amount,
  currency = 'ARS',
  payerEmail,
  publicKey = '',
  allowPayerEmailEdit = false,
  payerEmailHelpText = '',
  submitLabel = 'Pagar',
  maxInstallments = 1,
  onClose,
  onSubmit,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [payerEmailValue, setPayerEmailValue] = useState(payerEmail || '');

  const resolvedPublicKey = getMercadoPagoPublicKey(publicKey);
  const initialized = isMercadoPagoConfigured(resolvedPublicKey);

  useEffect(() => {
    if (open && resolvedPublicKey) {
      ensureMercadoPago(resolvedPublicKey);
    }
  }, [open, resolvedPublicKey]);

  useEffect(() => {
    if (open) {
      setPayerEmailValue(payerEmail || '');
      setErrorMessage('');
      setReady(false);
    }
  }, [open, payerEmail]);

  const initialization = useMemo(
    () => ({
      amount,
      payer: {
        email: payerEmailValue || '',
      },
    }),
    [amount, payerEmailValue],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-outline_variant/15 bg-surface_container_low p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>

            <h3 className="text-2xl font-display font-semibold text-on_surface">{title}</h3>
            {subtitle && <p className="mt-2 text-sm text-on_surface_variant">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-outline transition-colors hover:bg-surface_container hover:text-on_surface"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-6 rounded-[1.5rem] border border-primary/10 bg-primary/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CreditCard size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-outline">Importe a cobrar</p>
              <p className="text-2xl font-display font-semibold text-on_surface">{formatMoney(amount, currency)}</p>
            </div>
          </div>

        </div>



        {errorMessage && (
          <div className="mb-5 rounded-[1.5rem] border border-red-400/15 bg-red-400/5 px-5 py-4 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {initialized && (
          <div className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-4 sm:p-5">
            {allowPayerEmailEdit && (
              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-on_surface" htmlFor="mercadopago-payer-email">
                  Email de facturación
                </label>
                <input
                  id="mercadopago-payer-email"
                  type="email"
                  autoComplete="email"
                  value={payerEmailValue}
                  onChange={(event) => setPayerEmailValue(event.target.value)}
                  placeholder="tu@email.com"
                  className="w-full rounded-2xl border border-outline_variant/15 bg-surface_container_low px-4 py-3 text-sm text-on_surface outline-none transition-colors focus:border-primary"
                />
                {payerEmailHelpText && (
                  <p className="mt-2 text-xs leading-relaxed text-on_surface_variant">
                    {payerEmailHelpText}
                  </p>
                )}
              </div>
            )}

            {!ready && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface_container_highest px-3 py-1 text-xs text-on_surface_variant">
                <Loader2 size={14} className="animate-spin" />
                Cargando formulario seguro...
              </div>
            )}

            <CardPayment
              initialization={initialization}
              customization={{
                paymentMethods: {
                  minInstallments: 1,
                  maxInstallments,
                },
                visual: {
                  hideFormTitle: true,
                },
              }}
              locale="es-AR"
              onReady={() => setReady(true)}
              onError={(error) => {
                setErrorMessage(error.message || 'Mercado Pago no pudo inicializar el formulario.');
              }}
              onSubmit={async (formData, additionalData) => {
                setSubmitting(true);
                setErrorMessage('');

                try {
                  const normalizedPayerEmail = String(payerEmailValue || formData?.payer?.email || '').trim();

                  if (!normalizedPayerEmail) {
                    throw new Error('Ingresa un email de comprador para continuar.');
                  }

                  await onSubmit(
                    {
                      ...formData,
                      payer: {
                        ...(formData?.payer || {}),
                        email: normalizedPayerEmail,
                      },
                    },
                    additionalData,
                  );
                } catch (error) {
                  setErrorMessage(error.message || 'No se pudo procesar el pago.');
                } finally {
                  setSubmitting(false);
                }
              }}
            />


          </div>
        )}
      </div>
    </div>
  );
}
