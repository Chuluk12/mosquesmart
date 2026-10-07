import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, setToken, ApiError } from '../lib/api';

interface User { id: string; name: string; username: string; role: string }
interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const skipNextValidation = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (location.pathname === '/audio-schedule-public') {
      setUser(null);
      setLoading(false);
      return () => { active = false; };
    }
    if (skipNextValidation.current) {
      skipNextValidation.current = false;
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    api.get<User>('/auth/me')
      .then(value => { if (active) setUser(value); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [location.pathname]);

  const login = async (username: string, password: string) => {
    const res = await api.post<{ accessToken: string; user: User }>('/auth/login', { username, password });
    skipNextValidation.current = true;
    setToken(res.accessToken);
    setUser(res.user);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); }
    catch { /* Always clear this browser's credentials, even if the API is offline. */ }
    finally {
      setToken(null);
      setUser(null);
    }
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };