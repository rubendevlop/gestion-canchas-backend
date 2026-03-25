import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react';
import { fetchAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import MercadoPagoCardModal from '../../components/MercadoPagoCardModal';
import { normalizeBookingHours } from '../../utils/bookingHours';

export default function BookCourt() {
  const { complexId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const preselectedCourtId = searchParams.get('courtId') || '';

  const [courts, setCourts] = useState([]);
  const [selectedCourt, setSelectedCourt] = useState(preselectedCourtId);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedHour, setSelectedHour] = useState('');
  const [takenSlots, setTakenSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentSession, setPaymentSession] = useState(null);
  const [createdReservation, setCreatedReservation] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchAPI(`/courts?complexId=${complexId}&clientVisible=true`)
      .then(setCourts)
      .catch((error) => {
        setCourts([]);
        setErrorMessage(error.message || 'Este complejo no esta disponible para reservas.');
      })
      .finally(() => setLoading(false));
  }, [complexId]);

  useEffect(() => {
    if (!selectedCourt || !selectedDate) return;

    fetchAPI(`/reservations/taken?courtId=${selectedCourt}&date=${selectedDate}`)
      .then((data) => setTakenSlots(data.takenHours || []))
      .catch((error) => {
        setTakenSlots([]);
        if (error?.message) {
          setErrorMessage(error.message);
        }
      });
  }, [selectedCourt, selectedDate]);

  const handleBook = async () => {
    if (!selectedCourt || !selectedDate || !selectedHour) return;
    setBooking(true);
    setErrorMessage('');

    try {
      const response = await fetchAPI('/reservations', {
        method: 'POST',
        body: JSON.stringify({ courtId: selectedCourt, date: selectedDate, startTime: selectedHour }),
      });

      if (response.paymentSession?.reservationId && response.providerConfigured) {
        setCreatedReservation(response.reservation || null);
        setPaymentSession(response.paymentSession);
      } else {
        setSuccess(true);
        setTimeout(() => navigate('/portal/mis-reservas'), 2000);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Error al realizar la reserva.');
    } finally {
      setBooking(false);
    }
  };

  const handleReservationPayment = async (formData, additionalData) => {
    const reservationId = paymentSession?.reservationId || createdReservation?._id;
    if (!reservationId) {
      throw new Error('No hay una reserva pendiente para cobrar.');
    }

    const response = await fetchAPI(`/reservations/${reservationId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ formData, additionalData }),
    });

    setCreatedReservation(response.reservation || null);
    setPaymentSession(null);

    if (response.reservation?.paymentStatus === 'PAID') {
      setSuccess(true);
      setTimeout(() => navigate('/portal/mis-reservas'), 2000);
      return;
    }

    setErrorMessage('La reserva se creo, pero el cobro quedo pendiente o fue rechazado.');
  };

  const court = courts.find((item) => item._id === selectedCourt);
  const availableHours = normalizeBookingHours(court?.bookingHours);
  const selectedCourtImage = court?.imageUrl || court?.image || court?.images?.[0] || '';

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  if (!courts.length && errorMessage) {
    return <div className="py-20 text-center text-white/40">{errorMessage}</div>;
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <CheckCircle2 size={72} className="mb-6 text-green-400" />
        <h2 className="mb-2 text-3xl font-display font-bold text-white">Reserva confirmada</h2>
        <p className="text-white/40">Redirigiendo a tus reservas...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white"
      >
        <ChevronLeft size={16} />
        Volver al complejo
      </button>

      <h1 className="mb-8 text-3xl font-display font-bold text-white">Reservar cancha</h1>

      {errorMessage && (
        <div className="mb-6 rounded-2xl border border-red-400/15 bg-red-400/5 px-5 py-4 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      <Step number={1} title="Elegi la cancha">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {courts.map((item) => {
            const imageUrl = item.imageUrl || item.image || item.images?.[0] || '';

            return (
              <button
                key={item._id}
                onClick={() => {
                  setSelectedCourt(item._id);
                  setSelectedHour('');
                }}
                className={`overflow-hidden rounded-2xl border text-left transition-all ${
                  selectedCourt === item._id
                    ? 'border-primary bg-primary/10 text-white'
                    : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:text-white'
                }`}
              >
                <div className="h-40 bg-gradient-to-br from-white/5 to-white/10">
                  {imageUrl ? (
                    <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl text-white/20">Cancha</div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-0.5 text-xs opacity-60">{item.sport || 'Futbol 5'}</p>
                  </div>
                  <p className="font-semibold text-primary">${item.pricePerHour?.toLocaleString('es-AR')}/hr</p>
                </div>
              </button>
            );
          })}
        </div>
      </Step>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Step number={2} title="Elegi la fecha">
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setSelectedHour('');
              }}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm text-white transition-all focus:border-primary/50 focus:outline-none"
            />
          </Step>

          <Step number={3} title="Elegi el horario">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {availableHours.map((hour) => {
                const taken = takenSlots.includes(hour);
                return (
                  <button
                    key={hour}
                    disabled={taken}
                    onClick={() => setSelectedHour(hour)}
                    className={`rounded-2xl border py-3 text-sm font-semibold transition-all ${
                      taken
                        ? 'cursor-not-allowed border-white/5 bg-white/5 text-white/20'
                        : selectedHour === hour
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {taken ? <s>{hour}</s> : hour}
                  </button>
                );
              })}
            </div>
            {availableHours.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/50">
                Esta cancha no tiene horarios habilitados todavia.
              </p>
            )}
          </Step>
        </div>

        {selectedCourt && selectedDate && selectedHour && (
          <div className="rounded-2xl border border-primary/20 bg-white/5 p-6">
            <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/10">
              {selectedCourtImage ? (
                <img src={selectedCourtImage} alt={court?.name} className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-44 items-center justify-center text-5xl text-white/20">Cancha</div>
              )}
            </div>

            <h3 className="mb-3 font-semibold text-white">Resumen</h3>
            <div className="mb-5 space-y-2 text-sm text-white/60">
              <div className="flex justify-between">
                <span>Cancha</span>
                <span className="text-white">{court?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Fecha</span>
                <span className="text-white">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Hora</span>
                <span className="text-white">{selectedHour}</span>
              </div>
              <div className="mt-3 flex justify-between text-base font-semibold">
                <span className="text-white">Total</span>
                <span className="text-primary">${court?.pricePerHour?.toLocaleString('es-AR')}</span>
              </div>
            </div>
            <button
              onClick={handleBook}
              disabled={booking}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary py-4 font-bold text-on_primary_fixed transition-all hover:brightness-110 disabled:opacity-50"
            >
              {booking ? <Loader2 className="animate-spin" size={18} /> : null}
              {booking ? 'Procesando...' : 'Confirmar reserva'}
            </button>
          </div>
        )}
      </div>

      <MercadoPagoCardModal
        open={Boolean(paymentSession)}
        title="Pagar reserva"
        subtitle="El cobro se procesa con la cuenta Mercado Pago del complejo."
        amount={Number(paymentSession?.amount || court?.pricePerHour || 0)}
        currency={paymentSession?.currency || 'ARS'}
        payerEmail={paymentSession?.payer?.email || user?.email || ''}
        publicKey={paymentSession?.publicKey || ''}
        allowPayerEmailEdit
        payerEmailHelpText="Si estas probando en sandbox, usa el email de un comprador de prueba de Mercado Pago."
        submitLabel="reserva"
        onClose={() => setPaymentSession(null)}
        onSubmit={handleReservationPayment}
      />
    </div>
  );
}

function Step({ number, title, children }) {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
          {number}
        </div>
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}
