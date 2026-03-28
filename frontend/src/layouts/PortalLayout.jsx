import { Link, Outlet, useLocation } from 'react-router-dom';
import { CalendarRange, Home, LogOut, Search, ShoppingBag, User } from 'lucide-react';
import { logout } from '../auth';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/BrandLogo';

const NAV = [
  { name: 'Inicio', path: '/portal', icon: Home },
  { name: 'Mis Reservas', path: '/portal/mis-reservas', icon: CalendarRange },
  { name: 'Mis Compras', path: '/portal/mis-compras', icon: ShoppingBag },
  { name: 'Mi Perfil', path: '/portal/perfil', icon: User },
];

export default function PortalLayout() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-on_surface font-body">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(circle_at_top,rgba(123,207,82,0.1),transparent_48%)]" />
        <div className="absolute left-[-6rem] top-[6rem] h-[18rem] w-[18rem] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] h-[22rem] w-[22rem] rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-outline_variant/25 bg-white/84 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Link to="/portal" className="shrink-0 rounded-2xl border border-outline_variant/15 bg-white/85 px-3 py-2 shadow-[0_12px_24px_-20px_rgba(20,32,22,0.24)]">
              <BrandLogo imageClassName="h-9 w-auto sm:h-10" />
            </Link>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-outline_variant/15 bg-surface_container_low px-2 py-2">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="avatar" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {user?.displayName?.charAt(0) || 'U'}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-outline_variant/15 bg-surface_container_low px-3 py-2 text-sm font-medium text-on_surface transition-colors hover:border-error/20 hover:bg-red-500/10 hover:text-red-600 sm:px-4"
                title="Cerrar sesion"
              >
                <LogOut size={15} />
                <span className="hidden lg:inline">Cerrar sesion</span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative hidden max-w-md flex-1 md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={16} />
              <input
                type="text"
                placeholder="Buscar un complejo..."
                className="w-full rounded-full border border-outline_variant/15 bg-surface_container_low py-2.5 pl-11 pr-5 text-sm text-on_surface placeholder-on_surface_variant transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>

            <div className="overflow-x-auto pb-1">
              <nav className="flex min-w-max items-center gap-2">
                {NAV.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'border-primary/20 bg-primary/10 text-on_surface shadow-[0_10px_22px_-18px_rgba(31,143,73,0.26)]'
                          : 'border-outline_variant/15 bg-white/85 text-on_surface_variant hover:border-primary/25 hover:bg-surface_container_low hover:text-on_surface'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-primary' : 'text-outline'} />
                      <span className="whitespace-nowrap">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
