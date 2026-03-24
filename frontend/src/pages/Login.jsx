import { useState } from 'react';
import { loginWithGoogle } from '../firebase';
import { Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);

  const handleGoogleAuth = async () => {
    try {
      if (isRegistering) {
        localStorage.setItem('auth_intent', 'register');
      } else {
        localStorage.removeItem('auth_intent'); // Login explícito
      }
      await loginWithGoogle();
    } catch (error) {
      alert("Error al acceder: " + error.message);
      localStorage.removeItem('auth_intent');
    }
  };

  return (
    <div className="min-h-screen bg-background flex text-on_surface font-body overflow-hidden">
      
      {/* Sección Izquierda - Decorativa (Asimetría) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-surface_container_low border-r border-outline_variant/15">
        
        {/* Orbe de Luz Absoluto ("Shadows of Air") */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="z-10 relative">
          <h1 className="text-3xl font-display font-medium text-primary tracking-tight">Gestión Pro.</h1>
        </div>

        <div className="z-10 relative mt-auto">
          <h2 className="text-5xl font-display font-bold leading-tight mb-6">Administra tu complejo sin fricciones.</h2>
          <p className="text-on_surface_variant text-lg max-w-md">
            El SaaS minimalista diseñado para organizar tus canchas, reservas y ventas, transformando datos complejos en experiencias intuitivas.
          </p>
        </div>
      </div>

      {/* Sección Derecha - Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-md relative z-10">
          
          <div className="text-center lg:text-left mb-10">
            <h2 className="text-3xl font-display font-bold mb-2">
              {isRegistering ? 'Crear una cuenta' : 'Bienvenido de nuevo'}
            </h2>
            <p className="text-on_surface_variant">
              {isRegistering ? 'Empieza a gestionar tu recinto hoy mismo.' : 'Ingresa a tu panel de control.'}
            </p>
          </div>

          <div className="space-y-4">
            
            {/* Input Nombre (Solo Registro) */}
            {isRegistering && (
              <div>
                <label className="uppercase tracking-[0.03em] text-xs font-semibold text-outline mb-2 block">Nombre del Complejo o Dueño</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline_variant">
                    <UserIcon size={18} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Tu nombre" 
                    className="w-full bg-surface_container_lowest border border-outline_variant/15 rounded-xl py-3 pl-12 pr-4 text-on_surface placeholder-outline_variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                  />
                </div>
              </div>
            )}

            {/* Input Correo */}
            <div>
              <label className="uppercase tracking-[0.03em] text-xs font-semibold text-outline mb-2 block">Correo Electrónico</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline_variant">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  placeholder="ejemplo@correo.com" 
                  className="w-full bg-surface_container_lowest border border-outline_variant/15 rounded-xl py-3 pl-12 pr-4 text-on_surface placeholder-outline_variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                />
              </div>
            </div>

            {/* Input Contraseña */}
            <div>
              <label className="uppercase tracking-[0.03em] text-xs font-semibold text-outline mb-2 block">Contraseña</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline_variant">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full bg-surface_container_lowest border border-outline_variant/15 rounded-xl py-3 pl-12 pr-4 text-on_surface placeholder-outline_variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                />
              </div>
            </div>

            {/* Botón Principal (Gradiente) */}
            <button 
              onClick={(e) => {
                e.preventDefault();
                alert("El registro por email tradicional estará disponible pronto. Por favor utiliza 'Acceso Corporativo Google' debajo.");
              }}
              className="w-full bg-gradient-to-r from-primary_container to-primary text-on_primary_fixed font-semibold py-3 rounded-2xl mt-6 flex justify-center items-center gap-2 hover:brightness-110 transition-all shadow-[0_8px_24px_-8px_rgba(23,101,242,0.4)]"
            >
              {isRegistering ? 'Registrarse gratis' : 'Ingresar al sistema'}
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="my-8 flex items-center before:flex-1 before:border-t before:border-outline_variant/20 after:flex-1 after:border-t after:border-outline_variant/20">
            <span className="px-4 text-xs font-semibold text-outline uppercase tracking-wider">O continuar con</span>
          </div>

          <button 
            onClick={handleGoogleAuth} 
            className="w-full bg-surface_container_high text-on_surface py-3 rounded-2xl flex justify-center items-center gap-3 hover:bg-surface_container_highest transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Acceso Corporativo Google
          </button>

          <p className="text-center mt-8 text-sm text-on_surface_variant">
            {isRegistering ? '¿Ya tienes un complejo?' : '¿Quieres vender y gestionar tus canchas?'}
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="ml-2 text-primary font-semibold hover:underline bg-transparent border-none p-0"
            >
              {isRegistering ? 'Inicia sesión' : 'Regístrate aquí'}
            </button>
          </p>

        </div>
      </div>
    </div>
  );
}
