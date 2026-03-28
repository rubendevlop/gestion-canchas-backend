import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';

// Admin Panel (owner + superadmin)
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import Inventory from './pages/Inventory';
import Courts from './pages/Courts';
import Reservations from './pages/Reservations';
import OwnerBilling from './pages/OwnerBilling';
import OwnerCollections from './pages/OwnerCollections';
import OwnerCustomers from './pages/OwnerCustomers';
import AdminUsers from './pages/AdminUsers';
import AdminComplexes from './pages/AdminComplexes';
import AdminPayments from './pages/AdminPayments';
import Settings from './pages/Settings';

// Portal Cliente (client) – multi-tenant
import PortalLayout from './layouts/PortalLayout';
import PortalHome from './pages/portal/PortalHome';
import ComplexDetail from './pages/portal/ComplexDetail';
import BookCourt from './pages/portal/BookCourt';
import ComplexStore from './pages/portal/ComplexStore';
import Cart from './pages/portal/Cart';
import MyReservations from './pages/portal/MyReservations';
import MyOrders from './pages/portal/MyOrders';
import PortalPaymentResult from './pages/portal/PortalPaymentResult';
import PortalProfile from './pages/portal/PortalProfile';

function LoginGuard({ children }) {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (user && role) {
    if (role === 'client') return <Navigate to="/portal" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function RoleRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-primary">Cargando...</div>;
  if (!user || !role) return <Navigate to="/login" replace />;
  if (role === 'client') return <Navigate to="/portal" replace />;
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Login – si ya está logueado redirige */}
      <Route
        path="/login"
        element={
          <LoginGuard>
            <Login />
          </LoginGuard>
        }
      />

      {/* Raíz → redirige según rol */}
      <Route path="/" element={<RoleRedirect />} />

      {/* ─── PANEL ADMIN (owner / superadmin) ─── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['owner', 'superadmin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route
          path="courts"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <Courts />
            </ProtectedRoute>
          }
        />
        <Route
          path="reservations"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <Reservations />
            </ProtectedRoute>
          }
        />
        <Route
          path="products"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="collections"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <OwnerCollections />
            </ProtectedRoute>
          }
        />
        <Route
          path="billing"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <OwnerBilling />
            </ProtectedRoute>
          }
        />
        <Route
          path="customers"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <OwnerCustomers />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <Settings />
            </ProtectedRoute>
          }
        />
        {/* Solo superadmin */}
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="complexes"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <AdminComplexes />
            </ProtectedRoute>
          }
        />
        <Route
          path="payments"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <AdminPayments />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* ─── PORTAL CLIENTE (multi-tenant) ─── */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <PortalLayout />
          </ProtectedRoute>
        }
      >
        {/* Home: listado de todos los complejos */}
        <Route index element={<PortalHome />} />

        {/* Contexto de un complejo específico */}
        <Route path="complejo/:complexId" element={<ComplexDetail />} />
        <Route path="complejo/:complexId/reservar" element={<BookCourt />} />
        <Route path="complejo/:complexId/tienda" element={<ComplexStore />} />
        <Route path="complejo/:complexId/tienda/carrito" element={<Cart />} />
        <Route path="pago/mercadopago" element={<PortalPaymentResult />} />

        {/* Área personal del cliente */}
        <Route path="mis-reservas" element={<MyReservations />} />
        <Route path="mis-compras" element={<MyOrders />} />
        <Route path="perfil" element={<PortalProfile />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
