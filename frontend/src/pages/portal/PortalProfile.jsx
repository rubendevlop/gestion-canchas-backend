import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../firebase';
import { LogOut, Mail, User } from 'lucide-react';

export default function PortalProfile() {
  const { user, role } = useAuth();

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-3xl font-display font-bold text-white mb-10">Mi Perfil</h1>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6 text-center">
        {user?.photoURL ? (
          <img src={user.photoURL} alt="avatar" className="w-20 h-20 rounded-full mx-auto mb-4 ring-2 ring-primary/30"/>
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-primary text-3xl font-bold">{user?.displayName?.charAt(0) || 'U'}</span>
          </div>
        )}
        <h2 className="text-xl font-semibold text-white">{user?.displayName}</h2>
        <p className="text-white/40 text-sm mt-1 flex items-center gap-2 justify-center"><Mail size={13}/>{user?.email}</p>
        <span className="mt-3 inline-block text-xs text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-wider font-medium">Cliente</span>
      </div>

      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 text-white/50 hover:text-error border border-white/10 hover:border-error/30 py-4 rounded-2xl transition-all text-sm font-medium"
      >
        <LogOut size={16}/> Cerrar Sesión
      </button>
    </div>
  );
}
