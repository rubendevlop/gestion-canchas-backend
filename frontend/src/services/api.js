import { auth } from '../firebase';

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

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
    const error = new Error(data.message || data.error || `Error HTTP: ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};
