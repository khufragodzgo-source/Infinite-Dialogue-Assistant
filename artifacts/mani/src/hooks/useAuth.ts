import { useState, useEffect, useCallback } from "react";

export type AuthUser = {
  id: number;
  email: string;
  isAdmin: boolean;
};

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
};

export type UseAuthReturn = AuthState & {
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
};

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true });

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = (await res.json()) as { user: AuthUser | null };
      setState({ user: data.user, isLoading: false });
    } catch {
      setState({ user: null, isLoading: false });
    }
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || data.error) return { error: data.error ?? "Login failed" };
      setState({ user: data.user ?? null, isLoading: false });
      return {};
    } catch {
      return { error: "Connection error" };
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || data.error) return { error: data.error ?? "Registration failed" };
      setState({ user: data.user ?? null, isLoading: false });
      return {};
    } catch {
      return { error: "Connection error" };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setState({ user: null, isLoading: false });
  }, []);

  return { ...state, login, register, logout, refetch };
}
