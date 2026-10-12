import { createContext, useContext, useState } from 'react';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('iwms_user')); } catch { return null; }
  });
  const login = ({ token, user }) => {
    localStorage.setItem('iwms_token', token);
    localStorage.setItem('iwms_user', JSON.stringify(user));
    setUser(user);
  };
  const logout = () => {
    localStorage.removeItem('iwms_token');
    localStorage.removeItem('iwms_user');
    setUser(null);
  };
  // Mirrors the backend rule: Administrator can do everything.
  const can = (...roles) => !!user && (user.role === 'Administrator' || roles.includes(user.role));
  return <AuthCtx.Provider value={{ user, login, logout, can }}>{children}</AuthCtx.Provider>;
}
