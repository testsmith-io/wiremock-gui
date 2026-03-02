import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AuthContextValue, Role, AuthCheckResponse, LoginResponse } from './types';

const TOKEN_KEY = 'wiremock-gui-auth-token';

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

interface AuthProviderProps {
  baseUrl: string;
  children: ReactNode;
}

export function AuthProvider({ baseUrl, children }: AuthProviderProps) {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const clearAuth = useCallback(() => {
    setIsAuthenticated(false);
    setUsername(null);
    setRole(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  // check auth status whenever baseUrl or token changes
  const checkAuth = useCallback(async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}/__admin/gui/api/auth-check`, { headers });
      if (!res.ok) {
        // server might not have the auth endpoint (older version) — treat as auth disabled
        setAuthEnabled(false);
        setIsAuthenticated(false);
        return;
      }
      const data: AuthCheckResponse = await res.json();
      setAuthEnabled(data.authEnabled);
      if (!data.authEnabled) {
        // no auth required — full access
        setIsAuthenticated(false);
        setRole(null);
        setUsername(null);
        return;
      }
      if (data.authenticated && data.username && data.role) {
        setIsAuthenticated(true);
        setUsername(data.username);
        setRole(data.role);
      } else {
        clearAuth();
      }
    } catch {
      // connection error — don't change auth state
    }
  }, [baseUrl, token, clearAuth]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // listen for 401 events from wiremock-client
  useEffect(() => {
    const handler = () => clearAuth();
    window.addEventListener('wiremock-auth-expired', handler);
    return () => window.removeEventListener('wiremock-auth-expired', handler);
  }, [clearAuth]);

  const login = useCallback(async (user: string, pass: string) => {
    const res = await fetch(`${baseUrl}/__admin/gui/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }
    const data: LoginResponse = await res.json();
    setToken(data.token);
    setUsername(data.username);
    setRole(data.role);
    setIsAuthenticated(true);
    localStorage.setItem(TOKEN_KEY, data.token);
  }, [baseUrl]);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const value: AuthContextValue = {
    authEnabled,
    isAuthenticated,
    username,
    role,
    login,
    logout,
    canWrite: !authEnabled || role === 'admin' || role === 'editor',
    canAdmin: !authEnabled || role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
