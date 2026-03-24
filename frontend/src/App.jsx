import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardLayout from './layouts/DashboardLayout';
import Inventory from './pages/Inventory';
import Courts from './pages/Courts';
import Reservations from './pages/Reservations';
import { fetchAPI } from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'user', 'owner' (admin), 'superadmin'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      
      if (currentUser) {
         try {
           const intent = localStorage.getItem('auth_intent');

           if (intent === 'register') {
             // Registra intencionalmente al usuario
             const res = await fetchAPI('/users/register', { method: 'POST' });
             setRole(res.role);
             localStorage.removeItem('auth_intent');
           } else {
             // Intenta iniciar sesión. Falla si no fue creado primero
             const res = await fetchAPI('/users/login', { method: 'POST' });
             setRole(res.role);
           }
           
           setUser(currentUser); // Solo seteamos el usuario si el backend lo aprobó
         } catch (error) {
           console.error("Error autenticando con BD:", error);
           await auth.signOut(); // Revocar sesión de Firebase inmediatamente
           setUser(null);
           setRole(null);
           alert(error.message || "Acceso denegado. Asegúrate de registrarte primero.");
         }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-primary">Cargando Plataforma...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        
        {/* Rutas Privadas Workspace SaaS (Administradores/Dueños de Complejo) */}
        <Route path="/dashboard" element={user ? <DashboardLayout user={user} /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Inventory />} />
          <Route path="courts" element={<Courts />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="settings" element={<div className="p-10"><h2 className="text-2xl font-display font-medium text-on_surface">Ajustes</h2></div>} />
        </Route>

        {/* Home Redirect (Temporal) */}
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
