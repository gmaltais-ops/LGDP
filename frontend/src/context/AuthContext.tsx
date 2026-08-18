import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, clearToken } from "../api";

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  is_admin?: boolean;
  auth_provider?: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithEmergentSession: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await api.getToken();
      if (token) {
        await refresh();
      }
      setLoading(false);
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    await setToken(res.token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/register", { email, password, name });
    await setToken(res.token);
    setUser(res.user);
  };

  const loginWithEmergentSession = async (sessionId: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/emergent-session", { session_token: sessionId });
    await setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithEmergentSession, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
