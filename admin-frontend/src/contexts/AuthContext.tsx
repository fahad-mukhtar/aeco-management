import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

type Role = "super_admin" | "admin";

export type AuthUser = {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "factory-admin-auth";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";

type StoredAuth = {
  token: string;
  user: AuthUser;
};

const readStoredAuth = (): AuthState => {
  if (typeof window === "undefined") {
    return { token: null, user: null };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { token: null, user: null };
  }
  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (parsed.token && parsed.user) {
      return parsed;
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return { token: null, user: null };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>(() => readStoredAuth());

  const login = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const detail = await response
        .json()
        .then((data) => data?.detail ?? "Unable to login")
        .catch(() => "Unable to login");
      throw new Error(typeof detail === "string" ? detail : "Unable to login");
    }

    const data = await response.json();
    const authData: StoredAuth = {
      token: data.access_token,
      user: data.user,
    };

    setState(authData);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
  }, []);

  const logout = useCallback(() => {
    setState({ token: null, user: null });
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      token: state.token,
      isAuthenticated: Boolean(state.token),
      login,
      logout,
    }),
    [login, logout, state.token, state.user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};
