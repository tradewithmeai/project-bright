import { useState, useEffect, createContext, useContext } from 'react';
import type { User } from '../types';
import { authApi } from '../api';

interface AuthContext {
  user: User | null;
  loading: boolean;
  promptLogout: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContext>({
  user: null,
  loading: true,
  promptLogout: false,
  login: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider(): AuthContext {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptLogout, setPromptLogout] = useState(false);

  // Poll /me (increment C): surfaces the project-finish logout prompt, and — since /me
  // returns 401 for a booted session (increment B) — also realises the passive-boot signal
  // by dropping the user to the login screen. No websocket (Section 4): a 15s poll is enough.
  useEffect(() => {
    let active = true;
    const refresh = (initial: boolean) =>
      authApi.me()
        .then((u) => {
          if (!active) return;
          setUser(u);
          setPromptLogout(!!u.promptLogout);
        })
        .catch(() => {
          if (!active) return;
          setUser(null);
          setPromptLogout(false);
        })
        .finally(() => {
          if (initial && active) setLoading(false);
        });
    refresh(true);
    const id = setInterval(() => refresh(false), 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  async function login(email: string, password: string) {
    const u = await authApi.login(email, password);
    setUser(u);
    setPromptLogout(false);
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
    setPromptLogout(false);
  }

  return { user, loading, promptLogout, login, logout };
}
