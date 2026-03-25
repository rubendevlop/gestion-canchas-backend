import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  Settings,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { logout } from '../auth';
import { useAuth } from '../contexts/AuthContext';
import { fetchAPI } from '../services/api';

const ROLE_META = {
  owner: {
    label: 'Dueno / Admin',
    badgeClass: 'text-primary bg-primary/10',
    eyebrow: 'Panel Administrativo',
    searchPlaceholder: 'Buscar reservas, canchas, productos...',
    nav: [
      { name: 'Dashboard', path: '/dashboard', icon: Home },
      { name: 'Calendario', path: '/dashboard/reservations', icon: Calendar },
      { name: 'Canchas', path: '/dashboard/courts', icon: LayoutGrid },
      { name: 'Inventario', path: '/dashboard/products', icon: ShoppingBag },
      { name: 'Clientes', path: '/dashboard/customers', icon: Users },
      { name: 'Cobros', path: '/dashboard/collections', icon: CreditCard },
      { name: 'Mensualidad', path: '/dashboard/billing', icon: Clock3 },
      { name: 'Ajustes', path: '/dashboard/settings', icon: Settings },
    ],
  },
  superadmin: {
    label: 'Super Admin',
    badgeClass: 'text-tertiary bg-tertiary/10',
    eyebrow: 'Control Global',
    searchPlaceholder: 'Buscar owners, usuarios o complejos...',
    nav: [
      { name: 'Resumen', path: '/dashboard', icon: Home },
      { name: 'Validaciones', path: '/dashboard/users', icon: Users },
      { name: 'Complejos', path: '/dashboard/complexes', icon: Building2 },
      { name: 'Pagos', path: '/dashboard/payments', icon: CreditCard },
    ],
  },
};

function getOwnerApprovalStorageKey(uid) {
  return `owner-approved-notification-read:${uid}`;
}

function isOwnerApprovalUnread(role, ownerStatus, ownerApprovedSeen) {
  return role === 'owner' && ownerStatus === 'APPROVED' && !ownerApprovedSeen;
}

export default function DashboardLayout() {
  const { user, role, ownerStatus, ownerBilling } = useAuth();
  const location = useLocation();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ownerApprovedSeen, setOwnerApprovedSeen] = useState(false);
  const [pendingOwnersCount, setPendingOwnersCount] = useState(0);

  const meta = ROLE_META[role] ?? ROLE_META.owner;

  useEffect(() => {
    setSidebarOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.uid) {
      setOwnerApprovedSeen(false);
      return;
    }

    setOwnerApprovedSeen(localStorage.getItem(getOwnerApprovalStorageKey(user.uid)) === '1');
  }, [user?.uid]);

  useEffect(() => {
    if (role !== 'superadmin') {
      setPendingOwnersCount(0);
      return;
    }

    let active = true;

    fetchAPI('/users?role=owner&ownerStatus=PENDING')
      .then((users) => {
        if (!active) return;
        setPendingOwnersCount(Array.isArray(users) ? users.length : 0);
      })
      .catch(() => {
        if (!active) return;
        setPendingOwnersCount(0);
      });

    return () => {
      active = false;
    };
  }, [location.pathname, role]);

  const notifications = useMemo(() => {
    const items = [];

    if (role === 'owner' && ownerStatus === 'APPROVED') {
      items.push({
        id: 'owner-approved',
        title: 'Cuenta aprobada',
        description: 'Ya fuiste validado por un superadmin. Eres dueno de un complejo y ya podes usar el panel.',
        icon: CheckCircle2,
        tone: 'text-green-400 bg-green-400/10',
      });
    }

    if (role === 'owner' && ownerBilling?.status === 'GRACE') {
      items.push({
        id: 'owner-billing-grace',
        title: 'Pago mensual pendiente',
        description: `Tenes hasta ${new Date(ownerBilling.blockAt).toLocaleDateString('es-AR')} para pagar. Si no, se bloquea tu panel y tu complejo deja de aceptar reservas y compras.`,
        icon: CreditCard,
        tone: 'text-yellow-400 bg-yellow-400/10',
        path: '/dashboard/billing',
      });
    }

    if (role === 'owner' && ownerBilling?.status !== 'GRACE' && ownerBilling?.hasAccess && ownerBilling?.accessEndsAt) {
      const expiresAt = new Date(ownerBilling.accessEndsAt);
      const diffDays = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      items.push({
        id: 'owner-billing',
        title: diffDays <= 5 ? 'Mensualidad por vencer' : 'Acceso activo',
        description:
          diffDays <= 5
            ? `Tu acceso vence el ${expiresAt.toLocaleDateString('es-AR')}. Cuando termine el periodo se te va a pedir un nuevo pago mensual.`
            : `Tu acceso owner esta activo hasta el ${expiresAt.toLocaleDateString('es-AR')}.`,
        icon: CreditCard,
        tone:
          diffDays <= 5
            ? 'text-yellow-400 bg-yellow-400/10'
            : 'text-green-400 bg-green-400/10',
        path: '/dashboard/billing',
      });
    }

    if (role === 'superadmin' && pendingOwnersCount > 0) {
      items.push({
        id: 'pending-owners',
        title: 'Validaciones pendientes',
        description: `Tenes ${pendingOwnersCount} solicitud${pendingOwnersCount !== 1 ? 'es' : ''} de owner esperando aprobacion.`,
        icon: Clock3,
        tone: 'text-yellow-400 bg-yellow-400/10',
        path: '/dashboard/users',
      });
    }

    return items;
  }, [ownerBilling, ownerStatus, pendingOwnersCount, role]);

  const hasUnreadNotifications =
    isOwnerApprovalUnread(role, ownerStatus, ownerApprovedSeen) ||
    (role === 'superadmin' && pendingOwnersCount > 0);

  const isActivePath = (path) => {
    if (path === '/dashboard') {
      return location.pathname === path;
    }

    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleNotificationsToggle = () => {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);

    if (nextOpen && isOwnerApprovalUnread(role, ownerStatus, ownerApprovedSeen) && user?.uid) {
      localStorage.setItem(getOwnerApprovalStorageKey(user.uid), '1');
      setOwnerApprovedSeen(true);
    }
  };

  const renderNavItems = (mobile = false) =>
    meta.nav.map((item) => {
      const Icon = item.icon;
      const isActive = isActivePath(item.path);

      return (
        <Link
          key={item.name + item.path}
          to={item.path}
          onClick={() => mobile && setSidebarOpen(false)}
          className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 ${
            isActive
              ? 'bg-surface_container_highest text-on_surface shadow-[0_8px_24px_rgba(0,0,0,0.2)]'
              : 'text-on_surface_variant hover:bg-surface hover:text-on_surface'
          }`}
        >
          <Icon size={20} className={isActive ? 'text-primary drop-shadow-[0_0_8px_rgba(179,197,255,0.4)]' : ''} />
          <span className="font-medium text-sm tracking-wide">{item.name}</span>
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-background text-on_surface font-body lg:flex">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-surface_container_low flex flex-col shadow-[8px_0_30px_-15px_rgba(0,0,0,0.5)] transition-transform duration-300 lg:static lg:translate-x-0 lg:z-20 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 sm:p-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-medium text-primary tracking-tight">Clubes Tucumán</h1>
            <p className="text-[0.65rem] text-on_surface_variant uppercase tracking-widest mt-2">
              {meta.eyebrow}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar menu"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-xl text-outline hover:text-on_surface hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 sm:px-8 pb-3">
          <p className="text-[0.65rem] text-outline uppercase tracking-[0.2em]">Menu</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {renderNavItems(true)}
        </nav>

        <div className="p-6 mt-auto border-t border-outline_variant/10">
          <div className="flex items-center gap-3 mb-4 px-2">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full ring-2 ring-surface_container_highest" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface_container_highest flex items-center justify-center text-primary shrink-0">
                <span className="font-display font-medium">{user?.displayName?.charAt(0) || 'U'}</span>
              </div>
            )}
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-medium text-on_surface truncate">{user?.displayName}</p>
              <p className="text-xs text-outline truncate">{user?.email}</p>
            </div>
          </div>

          <div className="mb-4 px-2">
            <span className={`text-[0.65rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${meta.badgeClass}`}>
              {meta.label}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-on_surface_variant hover:text-error hover:bg-error/10 py-3 rounded-2xl transition-colors text-sm font-medium"
          >
            <LogOut size={16} /> Cerrar sesion
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-outline_variant/10">
          <div className="px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                aria-label="Abrir menu"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-surface_container_low text-on_surface_variant hover:bg-surface_container_highest hover:text-on_surface transition-colors"
              >
                <Menu size={18} />
              </button>

              <div className="min-w-0 lg:hidden">
                <p className="text-xs uppercase tracking-widest text-outline">{meta.eyebrow}</p>
                <p className="text-sm font-medium text-on_surface truncate">{meta.label}</p>
              </div>

              <div className="relative hidden sm:block flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline_variant" size={18} />
                <input
                  type="text"
                  placeholder={meta.searchPlaceholder}
                  className="w-full bg-surface_container border border-outline_variant/10 rounded-full py-2.5 pl-12 pr-6 text-sm text-on_surface placeholder-outline focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={handleNotificationsToggle}
                  className="relative p-2.5 rounded-full bg-surface_container_low text-on_surface_variant hover:bg-surface_container_highest transition-colors"
                >
                  <Bell size={20} />
                  {hasUnreadNotifications && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-background" />
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 top-full mt-3 w-[calc(100vw-2rem)] max-w-sm rounded-3xl border border-outline_variant/15 bg-surface_container_high shadow-[0_20px_60px_-20px_rgba(0,0,0,0.55)] overflow-hidden">
                    <div className="px-5 py-4 border-b border-outline_variant/10">
                      <p className="text-sm font-semibold text-on_surface">Notificaciones</p>
                      <p className="text-xs text-outline mt-1">
                        {notifications.length === 0 ? 'No hay novedades por ahora.' : 'Estado de tu cuenta y acciones pendientes.'}
                      </p>
                    </div>

                    {notifications.length === 0 ? (
                      <div className="px-5 py-8 text-sm text-on_surface_variant text-center">
                        No tenes notificaciones nuevas.
                      </div>
                    ) : (
                      <div className="p-3 space-y-2">
                        {notifications.map((notification) => {
                          const Icon = notification.icon;
                          const content = (
                            <div className="flex items-start gap-3 rounded-2xl px-4 py-4 bg-surface_container_low hover:bg-surface_container transition-colors">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${notification.tone}`}>
                                <Icon size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-on_surface">{notification.title}</p>
                                <p className="text-sm text-on_surface_variant mt-1">{notification.description}</p>
                              </div>
                            </div>
                          );

                          if (notification.path) {
                            return (
                              <Link
                                key={notification.id}
                                to={notification.path}
                                onClick={() => setNotificationsOpen(false)}
                              >
                                {content}
                              </Link>
                            );
                          }

                          return <div key={notification.id}>{content}</div>;
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-surface_container_low px-3 py-2.5 text-sm text-on_surface_variant transition-colors hover:bg-error/10 hover:text-error sm:px-4"
                title="Cerrar sesion"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Cerrar sesion</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-x-hidden overflow-y-auto px-4 sm:px-6 lg:px-10 pb-10 pt-5 sm:pt-6 lg:pb-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
