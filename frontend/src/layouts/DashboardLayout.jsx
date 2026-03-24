import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Calendar, LayoutGrid, ShoppingBag, Settings, LogOut, Bell, Search } from 'lucide-react';
import { logout } from '../firebase';

export default function DashboardLayout({ user }) {
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Calendario', path: '/dashboard/reservations', icon: Calendar },
    { name: 'Canchas', path: '/dashboard/courts', icon: LayoutGrid },
    { name: 'Inventario', path: '/dashboard/products', icon: ShoppingBag },
    { name: 'Ajustes', path: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-on_surface font-body flex overflow-hidden">
      
      {/* Sidebar Laterral (Surface Container Low) - Sin borde sólido rígido */}
      <aside className="w-72 bg-surface_container_low flex flex-col relative z-20 shadow-[8px_0_30px_-15px_rgba(0,0,0,0.5)]">
        <div className="p-8">
          <h1 className="text-2xl font-display font-medium text-primary tracking-tight">Gestión Pro.</h1>
          <p className="text-[0.65rem] text-on_surface_variant uppercase tracking-widest mt-2">Workspace Administrativo</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-surface_container_highest text-on_surface shadow-[0_8px_24px_rgba(0,0,0,0.2)] scale-[1.02]' 
                    : 'text-on_surface_variant hover:bg-surface hover:text-on_surface'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-primary drop-shadow-[0_0_8px_rgba(179,197,255,0.4)]' : ''} />
                <span className="font-medium text-sm tracking-wide">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-6 mt-auto">
           <div className="flex items-center gap-4 mb-6 px-2">
              {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-12 h-12 rounded-full ring-2 ring-surface_container_highest" />
              ) : (
                  <div className="w-12 h-12 rounded-full bg-surface_container_highest flex items-center justify-center text-primary shrink-0 ring-1 ring-outline_variant/20">
                    <span className="font-display font-medium text-lg">{user?.displayName?.charAt(0) || 'U'}</span>
                  </div>
              )}
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-display font-medium text-on_surface truncate">{user?.displayName}</p>
                <p className="text-xs text-outline truncate">{user?.email}</p>
              </div>
           </div>
           
           <button 
             onClick={handleLogout} 
             className="w-full flex items-center justify-center gap-3 text-on_surface_variant hover:text-error hover:bg-error/10 py-3 rounded-2xl transition-colors text-sm font-medium"
           >
             <LogOut size={18} /> Cerrar Sesión
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative w-full">
        {/* Top Navbar Glassmorphism */}
        <header className="h-20 bg-background/70 backdrop-blur-xl flex items-center justify-between px-10 relative z-10">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline_variant" size={18} />
            <input 
              type="text" 
              placeholder="Buscar reservas, canchas, productos..." 
              className="w-full bg-surface_container border border-outline_variant/10 rounded-full py-2.5 pl-12 pr-6 text-sm text-on_surface placeholder-outline focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-surface_container_highest transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2.5 rounded-full bg-surface_container_low text-on_surface_variant hover:bg-surface_container_highest transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-background"></span>
            </button>
          </div>
        </header>

        {/* Scrollable Content Layer */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-10 pb-12 pt-6">
           <Outlet />
        </div>
      </main>
    </div>
  );
}
