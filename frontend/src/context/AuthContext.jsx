import { createContext, useCallback, useEffect, useState } from 'react';
import api, { TOKEN_STORAGE_KEY } from '../services/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [saldoVacaciones, setSaldoVacaciones] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));

  const fetchMe = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedToken) {
      setUser(null);
      setSaldoVacaciones(null);
      setLoading(false);
      return null;
    }

    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user || null);
      setSaldoVacaciones(data.saldo_vacaciones || null);
      return data;
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
      setSaldoVacaciones(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [token, fetchMe]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setToken(data.token);
    setUser(data.user);

    // Cargar perfil completo y saldo de vacaciones inmediatamente
    try {
      const meRes = await api.get('/auth/me');
      setUser(meRes.data.user || data.user);
      setSaldoVacaciones(meRes.data.saldo_vacaciones || null);
    } catch {
      setSaldoVacaciones(null);
    }

    return data.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setSaldoVacaciones(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        saldoVacaciones,
        loading,
        isAuthenticated: Boolean(token && user),
        login,
        logout,
        refreshProfile: fetchMe
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

