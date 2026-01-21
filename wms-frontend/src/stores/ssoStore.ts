import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SSOUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface SSOState {
  user: SSOUser | null;
  role: 'admin' | 'editor' | 'viewer' | null;
  accessToken: string | null;

  setUser: (user: SSOUser | null) => void;
  setRole: (role: 'admin' | 'editor' | 'viewer' | null) => void;
  setAccessToken: (token: string | null) => void;
  clearAuth: () => void;
}

export const useSSOStore = create<SSOState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      accessToken: null,

      setUser: (user) => set({ user }),
      setRole: (role) => set({ role }),
      setAccessToken: (token) => set({ accessToken: token }),

      clearAuth: () => set({
        user: null,
        role: null,
        accessToken: null,
      }),
    }),
    {
      name: 'swiftstock-sso-storage',
    }
  )
);
