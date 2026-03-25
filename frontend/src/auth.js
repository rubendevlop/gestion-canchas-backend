import { auth } from './firebase';
import { signOut } from 'firebase/auth';

/**
 * Limpia TODA la sesión: Firebase auth, sessionStorage, localStorage de auth,
 * y cualquier cookie de sesión relevante.
 */
export const logout = async () => {
  try {
    // 1. Cerrar sesión de Firebase
    await signOut(auth);

    // 2. Limpiar storage de auth
    sessionStorage.removeItem('role');
    localStorage.removeItem('auth_intent');
    localStorage.removeItem('register_as');

    // 3. Limpiar cookies de sesión (si las hay)
    document.cookie.split(';').forEach((c) => {
      const cookieName = c.trim().split('=')[0];
      // Expirar la cookie
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
};
