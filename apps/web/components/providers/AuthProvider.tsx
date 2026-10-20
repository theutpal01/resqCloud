"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Actor } from "../../../../packages/shared/src/index";
import { Toaster } from "sonner";
import { api, post, setToken, restoreSession } from "../../lib/api";
interface AuthState {
  cognito: (idToken: string) => Promise<void>;
  user: Actor | null;
  loading: boolean;
  signIn: (data: {
    email: string;
    password: string;
    otp?: string;
  }) => Promise<void>;
  demoSignIn: (role: Actor["role"]) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    restoreSession()
      .then(async (success) => {
        if (success) setUser(await api<Actor>("/auth/me"));
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  const establish = async (path: string, data: unknown) => {
    const result = await post<{ user: Actor; accessToken: string }>(path, data);
    setToken(result.accessToken);
    setUser(result.user);
  };
  return (
    <Context.Provider
      value={{
        cognito: (idToken) => establish("/auth/cognito", { idToken }),
        user,
        loading,
        signIn: (data) => establish("/auth/login", data),
        demoSignIn: (role) => establish("/auth/demo-login", { role }),
        register: (data) => establish("/auth/register", data),
        logout: async () => {
          try {
            await post("/auth/logout");
          } finally {
            setToken(null);
            setUser(null);
          }
        },
      }}
    >
      {children}
        <Toaster position="top-right" closeButton richColors />
    </Context.Provider>
  );
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("AuthProvider missing");
  return context;
}
