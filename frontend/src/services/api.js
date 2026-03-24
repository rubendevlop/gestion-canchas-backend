import { auth } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL || 'https://gestioncanchasbackend.vercel.app/api';

export const fetchAPI = async (endpoint, options = {}) => {
  let token = null;
  if (auth.currentUser) {
    token = await auth.currentUser.getIdToken();
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Error HTTP: ${response.status}`);
  }

  return data;
};
