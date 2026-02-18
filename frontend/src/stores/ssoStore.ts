import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SSOUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface WMSUser {
  user_id: number;
  username: string;
  email?: string;
  full_name?: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  warehouse_code?: string;
}

interface SSOState {
  user: SSOUser | null;
  role: 'admin' | 'editor' | 'viewer' | null;
  accessToken: string | null;
  wmsUser: WMSUser | null;

  setUser: (user: SSOUser | null) => void;
  setRole: (role: 'admin' | 'editor' | 'viewer' | null) => void;
  setAccessToken: (token: string | null) => void;
  setWMSUser: (user: WMSUser | null) => void;
  clearAuth: () => void;
}

export const useSSOStore = create<SSOState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      accessToken: null,
      wmsUser: null,

      setUser: (user) => set({ user }),
      setRole: (role) => set({ role }),
      setAccessToken: (token) => set({ accessToken: token }),
      setWMSUser: (wmsUser) => set({ wmsUser }),

      clearAuth: () => set({
        user: null,
        role: null,
        accessToken: null,
        wmsUser: null,
      }),
    }),
    {
      name: 'swiftstock-sso-storage',
    }
  )
);
