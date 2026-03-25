import { Link, Outlet, useLocation } from 'react-router-dom';
import { CalendarRange, Home, LogOut, Search, User } from 'lucide-react';
import { logout } from '../auth';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { name: 'Inicio', path: '/portal', icon: Home },
  { name: 'Mis Reservas', path: '/portal/mis-reservas', icon: CalendarRange },
  { name: 'Mi Perfil', path: '/portal/perfil', icon: User },
];

export default function PortalLayout() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-body">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/portal" className="shrink-0 text-lg font-display font-semibold tracking-tight text-white">
            Clubes <span className="text-primary">Tucumán</span>
          </Link>

          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="text"
              placeholder="Buscar un complejo..."
              className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-11 pr-5 text-sm text-white placeholder-white/30 transition-all focus:border-primary/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:block">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm text-white/60 transition-colors hover:bg-red-500/10 hover:text-red-300 sm:px-4"
              title="Cerrar sesion"
            >
              <LogOut size={15} />
              <span className="hidden md:inline">Cerrar sesion</span>
            </button>

            <div className="ml-1 flex items-center gap-2 border-l border-white/10 pl-3">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="h-8 w-8 rounded-full" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {user?.displayName?.charAt(0) || 'U'}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
