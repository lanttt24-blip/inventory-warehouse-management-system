const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export function getToken() { return localStorage.getItem('iwms_token'); }

export async function api(path, { method = 'GET', body, params } = {}) {
  let url = `${BASE}/api${path}`;
  if (params) {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    if ([...q].length) url += `?${q}`;
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again. (The free server may need up to a minute to wake up.)');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') {
    localStorage.removeItem('iwms_token');
    localStorage.removeItem('iwms_user');
    window.location.href = '/login';
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}
export const loginRequest = (email, password) => api('/auth/login', { method: 'POST', body: { email, password } });
