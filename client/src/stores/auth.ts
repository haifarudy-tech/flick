import { create } from 'zustand';
import type { Role, Plan } from '@flick/shared/types';

// Auth store. The accessToken is kept in-memory ONLY — never in localStorage.
// The refresh cookie is set by the server as httpOnly, so it survives reloads
// and can refresh this state silently on app boot.
//
// Rules:
//   - accessToken lives here, passed to fetch() via the api client
//   - refreshing is owned by `api.ts` — it calls `setAccessToken`
//   - on 401 with no refresh token, `setAuth(null)` triggers redirect to /login

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: Role;
}

export interface AuthBusiness {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
}

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  business: AuthBusiness | null;
  status: 'idle' | 'refreshing' | 'authenticated' | 'unauthenticated';
  setAuth: (p: { accessToken: string; user: AuthUser; business: AuthBusiness }) => void;
  setAccessToken: (token: string | null) => void;
  setStatus: (status: AuthState['status']) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  business: null,
  status: 'idle',
  setAuth: ({ accessToken, user, business }) =>
    set({ accessToken, user, business, status: 'authenticated' }),
  setAccessToken: (token) =>
    set((s) => ({
      accessToken: token,
      status: token ? 'authenticated' : 'unauthenticated',
      user: token ? s.user : null,
      business: token ? s.business : null,
    })),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, user: null, business: null, status: 'unauthenticated' }),
}));

// Non-hook accessor for use inside the fetch interceptor (no React context there).
export const authSnapshot = () => useAuthStore.getState();
