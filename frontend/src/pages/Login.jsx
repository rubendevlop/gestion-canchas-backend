import { useState } from 'react';
import { loginWithGoogle, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { fetchAPI } from '../services/api';
import {
  Mail, Lock, User as UserIcon, ArrowRight, Building2,
  Users, Shield, CheckCircle2, X, ExternalLink, Cookie
} from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register-client' | 'register-owner'
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cookieBannerDismissed, setCookieBannerDismissed] = useState(
    () => !!localStorage.getItem('cookies_accepted')
  );

  const isRegistering = mode !== 'login';

  // Paso 1: abre modal de verificación antes de lanzar Google
  const handleRegisterIntent = () => {
    if (!termsAccepted) {
      alert('Debés aceptar los Términos y Condiciones para continuar.');
      return;
    }
    setShowConfirmModal(true);
  };

  // Paso 2: usuario confirma → OAuth → registro en BD → sign out → redirect a login
  const handleConfirmedRegister = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    try {
      localStorage.setItem('auth_intent', 'register');
      localStorage.setItem('register_as', mode === 'register-owner' ? 'owner' : 'client');

      // OAuth con Google
      const firebaseUser = await loginWithGoogle();

      // Registrar en el backend
      const registerAs = mode === 'register-owner' ? 'owner' : 'client';
      await fetchAPI('/users/register', {
        method: 'POST',
        body: JSON.stringify({ registerAs }),
      });

      // Limpiar y cerrar sesión → el usuario debe hacer login explícito
      localStorage.removeItem('auth_intent');
      localStorage.removeItem('register_as');
      sessionStorage.removeItem('role');
      await signOut(auth);

      // Mostrar éxito
      setRegisteredSuccess(true);
      setMode('login');
      setTermsAccepted(false);

    } catch (error) {
      console.error('Error en registro:', error);
      localStorage.removeItem('auth_intent');
      localStorage.removeItem('register_as');
      // Intentar cerrar sesión si se abrió
      try { await signOut(auth); } catch (_) {}
      if (!error.message?.includes('popup-closed')) {
        alert('Error al registrarse: ' + (error.message || 'Intentá de nuevo.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Login normal con Google
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('auth_intent');
      localStorage.removeItem('register_as');
      await loginWithGoogle();
      // El AuthContext se encarga del redirect según rol
    } catch (error) {
      if (!error.message?.includes('popup-closed')) {
        alert('Error al iniciar sesión: ' + (error.message || 'Intentá de nuevo.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const acceptCookies = () => {
    localStorage.setItem('cookies_accepted', '1');
    setCookieBannerDismissed(true);
  };

  return (
    <div className="min-h-screen bg-background flex text-on_surface font-body overflow-hidden">

      {/* Panel izquierdo decorativo */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-surface_container_low border-r border-outline_variant/15">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="z-10 relative">
          <h1 className="text-3xl font-display font-medium text-primary tracking-tight">Clubes Tucumán</h1>
        </div>
        <div className="z-10 relative mt-auto">
          <h2 className="text-5xl font-display font-bold leading-tight mb-6">
            Gestioná tu complejo con claridad.
          </h2>
          <p className="text-on_surface_variant text-lg max-w-md">
            Gestioná canchas, reservas y ventas desde un solo lugar. Simple, moderno y sin complicaciones.
          </p>
          <div className="mt-8 flex gap-4">
            {['Canchas', 'Reservas', 'Tienda', 'Multi-complejo'].map((tag) => (
              <span key={tag} className="text-xs bg-surface_container px-3 py-1.5 rounded-full text-on_surface_variant border border-outline_variant/15">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-md">

          {/* Éxito de registro */}
          {registeredSuccess && (
            <div className="mb-6 bg-green-400/10 border border-green-400/20 rounded-2xl px-5 py-4 flex items-start gap-3">
              <CheckCircle2 size={20} className="text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-400 text-sm">¡Cuenta creada exitosamente!</p>
                <p className="text-green-400/70 text-xs mt-0.5">Iniciá sesión con tus credenciales para acceder.</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center lg:text-left mb-8">
            <h2 className="text-3xl font-display font-bold mb-2">
              {mode === 'login' && 'Bienvenido de nuevo'}
              {mode === 'register-client' && 'Crear cuenta de cliente'}
              {mode === 'register-owner' && 'Registrar mi complejo'}
            </h2>
            <p className="text-on_surface_variant">
              {mode === 'login' && 'Ingresá para acceder a tu panel.'}
              {mode === 'register-client' && 'Reservá canchas y comprá en segundos.'}
              {mode === 'register-owner' && 'Empezá a gestionar tus canchas hoy.'}
            </p>
          </div>

          {/* Selector de tipo de cuenta (solo en registro) */}
          {isRegistering && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <AccountTypeCard
                icon={<Users size={22} />}
                title="Soy cliente"
                desc="Quiero reservar canchas"
                active={mode === 'register-client'}
                onClick={() => setMode('register-client')}
              />
              <AccountTypeCard
                icon={<Building2 size={22} />}
                title="Soy dueño"
                desc="Tengo un complejo"
                active={mode === 'register-owner'}
                onClick={() => setMode('register-owner')}
              />
            </div>
          )}

          {/* Campos del formulario (decorativos por ahora) */}
          <div className="space-y-4">
            {isRegistering && (
              <FormField
                icon={<UserIcon size={18} />}
                placeholder={mode === 'register-owner' ? 'Nombre del complejo' : 'Tu nombre'}
                label="Nombre"
              />
            )}
            <FormField icon={<Mail size={18} />} placeholder="ejemplo@correo.com" label="Correo Electrónico" type="email" />
            <FormField icon={<Lock size={18} />} placeholder="••••••••" label="Contraseña" type="password" />

            {/* Términos y condiciones (solo en registro) */}
            {isRegistering && (
              <label className="flex items-start gap-3 cursor-pointer group mt-2">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 accent-[var(--color-primary)] w-4 h-4"
                />
                <span className="text-xs text-on_surface_variant leading-relaxed">
                  Al registrarme acepto los{' '}
                  <button
                    type="button"
                    onClick={() => alert('Términos y Condiciones: versión demo.')}
                    className="text-primary underline underline-offset-2 hover:text-primary_fixed transition-colors"
                  >
                    Términos y Condiciones
                  </button>{' '}
                  y la{' '}
                  <button
                    type="button"
                    onClick={() => alert('Política de Privacidad: versión demo.')}
                    className="text-primary underline underline-offset-2 hover:text-primary_fixed transition-colors"
                  >
                    Política de Privacidad
                  </button>.
                </span>
              </label>
            )}

            <button
              onClick={(e) => {
                e.preventDefault();
                alert('El acceso por email estará disponible pronto. Usá Google por ahora.');
              }}
              className="w-full bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold py-3 rounded-2xl mt-2 flex justify-center items-center gap-2 hover:brightness-110 transition-all shadow-[0_8px_24px_-8px_rgba(23,101,242,0.4)] disabled:opacity-50"
              disabled={loading}
            >
              {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Separador */}
          <div className="my-6 flex items-center before:flex-1 before:border-t before:border-outline_variant/20 after:flex-1 after:border-t after:border-outline_variant/20">
            <span className="px-4 text-xs font-semibold text-outline uppercase tracking-wider">O continuar con</span>
          </div>

          {/* Google */}
          <button
            onClick={isRegistering ? handleRegisterIntent : handleGoogleLogin}
            disabled={loading}
            className="w-full bg-surface_container_high text-on_surface py-3 rounded-2xl flex justify-center items-center gap-3 hover:bg-surface_container_highest transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-on_surface_variant border-t-transparent rounded-full animate-spin" />
            ) : <GoogleIcon />}
            {loading ? 'Procesando...' : (
              mode === 'login' ? 'Ingresar con Google' :
              mode === 'register-owner' ? 'Registrar complejo con Google' :
              'Registrarse con Google'
            )}
          </button>

          {/* Toggle login / registro */}
          <p className="text-center mt-6 text-sm text-on_surface_variant">
            {isRegistering ? '¿Ya tenés cuenta?' : '¿No tenés cuenta?'}
            <button
              onClick={() => { setMode(isRegistering ? 'login' : 'register-client'); setTermsAccepted(false); setRegisteredSuccess(false); }}
              className="ml-2 text-primary font-semibold hover:underline bg-transparent border-none p-0"
            >
              {isRegistering ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          </p>

          {mode === 'login' && (
            <p className="text-center mt-1 text-sm text-on_surface_variant">
              ¿Tenés un complejo?
              <button
                onClick={() => setMode('register-owner')}
                className="ml-2 text-secondary font-semibold hover:underline bg-transparent border-none p-0"
              >
                Registrar mi complejo
              </button>
            </p>
          )}
        </div>
      </div>

      {/* ─── Modal de confirmación ─── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface_container_low rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-outline_variant/20 relative">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="absolute top-4 right-4 text-outline hover:text-on_surface transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-5">
              <Shield size={28} className="text-primary" />
            </div>

            <h3 className="text-xl font-display font-bold text-on_surface text-center mb-2">
              Confirmá tu registro
            </h3>
            <p className="text-on_surface_variant text-sm text-center mb-6">
              Vas a crear una cuenta como{' '}
              <span className="font-semibold text-primary">
                {mode === 'register-owner' ? 'Dueño de Complejo' : 'Cliente'}
              </span>
              . Se abrirá Google para autenticarte.
            </p>

            <div className="space-y-2 text-xs text-on_surface_variant mb-6 bg-surface_container rounded-2xl p-4">
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-400 shrink-0"/>Tus datos se guardan de forma segura</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-400 shrink-0"/>Podés cancelar en cualquier momento</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-400 shrink-0"/>Luego deberás iniciar sesión manualmente</p>
            </div>

            <button
              onClick={handleConfirmedRegister}
              className="w-full bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-bold py-3.5 rounded-2xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <GoogleIcon /> Continuar con Google
            </button>
            <button
              onClick={() => setShowConfirmModal(false)}
              className="w-full text-center text-sm text-outline hover:text-on_surface transition-colors mt-3 py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ─── Cookie Banner ─── */}
      {!cookieBannerDismissed && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-40 bg-surface_container_high border border-outline_variant/20 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-start gap-3 mb-4">
            <Cookie size={20} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-on_surface text-sm">Usamos cookies 🍪</p>
              <p className="text-on_surface_variant text-xs mt-1 leading-relaxed">
                Utilizamos cookies para mejorar tu experiencia y mantener tu sesión activa.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={acceptCookies}
              className="flex-1 bg-primary text-on_primary_fixed text-sm font-semibold py-2.5 rounded-xl hover:brightness-110 transition-all"
            >
              Aceptar
            </button>
            <button
              onClick={() => {
                alert('Política de cookies: versión demo.');
              }}
              className="text-sm text-outline hover:text-on_surface transition-colors flex items-center gap-1 px-3"
            >
              Más info <ExternalLink size={12}/>
            </button>
            <button
              onClick={() => setCookieBannerDismissed(true)}
              className="text-outline hover:text-on_surface transition-colors p-1"
            >
              <X size={16}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────
function AccountTypeCard({ icon, title, desc, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-outline_variant/20 bg-surface_container text-on_surface_variant hover:border-primary/40 hover:text-on_surface'
      }`}
    >
      <div className={active ? 'text-primary' : 'text-outline'}>{icon}</div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs opacity-70 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

function FormField({ icon, placeholder, label, type = 'text' }) {
  return (
    <div>
      <label className="uppercase tracking-[0.03em] text-xs font-semibold text-outline mb-2 block">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline_variant">{icon}</div>
        <input
          type={type}
          placeholder={placeholder}
          className="w-full bg-surface_container_lowest border border-outline_variant/15 rounded-xl py-3 pl-12 pr-4 text-on_surface placeholder-outline_variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
        />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
