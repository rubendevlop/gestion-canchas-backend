import { useAuth } from '../contexts/AuthContext';
import Dashboard from './Dashboard';
import SuperadminDashboard from './SuperadminDashboard';

export default function DashboardHome() {
  const { role } = useAuth();

  if (role === 'superadmin') {
    return <SuperadminDashboard />;
  }

  return <Dashboard />;
}
