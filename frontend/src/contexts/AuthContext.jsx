import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { fetchAPI } from '../services/api';

const AuthContext = createContext(null);

function readCachedBilling() {
  try {
    const cached = sessionStorage.getItem('ownerBilling');
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [ownerStatus, setOwnerStatus] = useState(null);
  const [ownerStatusNote, setOwnerStatusNote] = useState('');
  const [ownerBilling, setOwnerBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyProfile = (profile, currentUser) => {
    setUser(
      currentUser
        ? {
            ...currentUser,
            displayName: profile.displayName ?? currentUser.displayName ?? '',
            email: profile.email ?? currentUser.email ?? '',
            photoURL: profile.photoURL ?? currentUser.photoURL ?? '',
            phone: profile.phone ?? '',
          }
        : null,
    );
    setRole(profile.role);
    setOwnerStatus(profile.ownerStatus ?? null);
    setOwnerStatusNote(profile.ownerStatusNote ?? '');
    setOwnerBilling(profile.ownerBilling ?? null);

    sessionStorage.setItem('role', profile.role ?? '');
    sessionStorage.setItem('ownerStatus', profile.ownerStatus ?? '');
    sessionStorage.setItem('ownerStatusNote', profile.ownerStatusNote ?? '');
    sessionStorage.setItem('ownerBilling', JSON.stringify(profile.ownerBilling ?? null));
  };

  const clearProfile = () => {
    setUser(null);
    setRole(null);
    setOwnerStatus(null);
    setOwnerStatusNote('');
    setOwnerBilling(null);
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('ownerStatus');
    sessionStorage.removeItem('ownerStatusNote');
    sessionStorage.removeItem('ownerBilling');
  };

  const refreshProfile = async () => {
    const profile = await fetchAPI('/users/me');
    if (!auth.currentUser) return profile;
    applyProfile(profile, auth.currentUser);
    return profile;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const profile = await fetchAPI('/users/login', { method: 'POST' });
          applyProfile(profile, currentUser);
        } catch (error) {
          console.error('Error obteniendo rol del backend:', error);
          const cachedRole = sessionStorage.getItem('role');

          if (cachedRole) {
            setUser(currentUser);
            setRole(cachedRole);
            setOwnerStatus(sessionStorage.getItem('ownerStatus') || null);
            setOwnerStatusNote(sessionStorage.getItem('ownerStatusNote') || '');
            setOwnerBilling(readCachedBilling());
          } else {
            // No cached session and backend unreachable — clear everything
            // so the user lands on /login instead of spinning forever.
            clearProfile();
          }
        }
      } else {
        clearProfile();
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        ownerStatus,
        ownerStatusNote,
        ownerBilling,
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }

  return context;
}
