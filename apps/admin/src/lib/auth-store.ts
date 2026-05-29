'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  isEmailVerified: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** false до завершения регидрации persist из localStorage; гард не редиректит, пока false */
  hasHydrated: boolean;
  setTokens: (data: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  clear: () => void;
  refresh: () => Promise<boolean>;
  setHasHydrated: (v: boolean) => void;
}

const PUBLIC_API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://192.168.1.8:3001/api/v1';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      setTokens: (data) =>
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        }),
      clear: () => {
        // best-effort logout
        const rt = get().refreshToken;
        if (rt) {
          void fetch(`${PUBLIC_API_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          });
        }
        set({ accessToken: null, refreshToken: null, user: null });
      },
      refresh: async () => {
        const rt = get().refreshToken;
        if (!rt) return false;
        try {
          const res = await fetch(`${PUBLIC_API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (!res.ok) {
            set({ accessToken: null, refreshToken: null, user: null });
            return false;
          }
          const data = (await res.json()) as { accessToken: string; refreshToken: string };
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
          return true;
        } catch {
          set({ accessToken: null, refreshToken: null, user: null });
          return false;
        }
      },
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'domkrat-admin-auth',
      // Персистим только данные (не hasHydrated). Для prod лучше httpOnly cookie,
      // но для MVP без BFF — приемлемо.
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
