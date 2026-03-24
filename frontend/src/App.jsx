import { useState } from 'react';
import { loginWithGoogle, logout } from './firebase';

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = async () => {
    try {
      const loggedUser = await loginWithGoogle();
      setUser(loggedUser);
    } catch (error) {
      alert("Necesitas configurar las credenciales de Firebase en el archivo .env.local para que esto funcione.");
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Elemento de iluminación de fondo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="card max-w-lg w-full z-10 text-center glass-panel">
        <h1 className="text-4xl text-on_surface mb-2">Gestión Pro</h1>
        <p className="text-on_surface_variant mb-10 text-sm tracking-wider uppercase">Panel de Control de Canchas</p>

        {!user ? (
          <div>
            <h2 className="text-xl mb-6 font-manrope">Inicia sesión</h2>
            <button onClick={handleLogin} className="btn-primary w-full flex justify-center items-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#001849" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#001849" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#001849" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#001849" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar con Google
            </button>
          </div>
        ) : (
          <div className="animate-fade-in text-left">
            <h2 className="text-2xl mb-4 font-manrope">Hola, {user.displayName}</h2>
            <p className="text-on_surface_variant mb-6 text-sm">{user.email}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-surface_container p-4 rounded-2xl">
                <p className="text-outline text-xs uppercase mb-1">Canchas</p>
                <p className="text-primary text-2xl font-bold">12</p>
              </div>
              <div className="bg-surface_container p-4 rounded-2xl">
                <p className="text-outline text-xs uppercase mb-1">Reservas</p>
                <p className="text-secondary text-2xl font-bold">48</p>
              </div>
            </div>

            <button onClick={handleLogout} className="btn-secondary w-full">
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
