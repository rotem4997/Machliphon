import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

export type UserRole = 'substitute' | 'manager' | 'authority_admin' | 'super_admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  authorityId?: string;
  authorityName?: string;
  profile?: Record<string, unknown>;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isDemoMode: boolean;

  login: (email: string, password: string) => Promise<void>;
  loginDemo: (role: 'authority_admin' | 'manager' | 'substitute') => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const DEMO_PROFILES: Record<string, User> = {
  authority_admin: {
    id: 'demo-director-1',
    email: 'director@yokneam.muni.il',
    role: 'authority_admin',
    firstName: 'ירון',
    lastName: 'כהן',
    phone: '04-9590000',
    authorityId: 'auth-yokneam-1',
    authorityName: 'עיריית יקנעם עילית',
  },
  manager: {
    id: 'demo-manager-1',
    email: 'manager@yokneam.muni.il',
    role: 'manager',
    firstName: 'שרה',
    lastName: 'לוי',
    phone: '052-1234567',
    authorityId: 'auth-yokneam-1',
    authorityName: 'עיריית יקנעם עילית',
  },
  substitute: {
    id: 'demo-sub-1',
    email: 'miriam@example.com',
    role: 'substitute',
    firstName: 'מרים',
    lastName: 'אברהם',
    phone: '054-1234567',
    authorityId: 'auth-yokneam-1',
    authorityName: 'עיריית יקנעם עילית',
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,
      isDemoMode: false,

      loginDemo: async (role) => {
        const creds: Record<string, { email: string; password: string }> = {
          authority_admin: { email: 'director@yokneam.muni.il', password: 'Demo1234!' },
          manager:         { email: 'manager@yokneam.muni.il',  password: 'Demo1234!' },
          substitute:      { email: 'miriam@example.com',        password: 'Demo1234!' },
        };
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', creds[role]);
          set({ user: data.user, token: data.token, refreshToken: data.refreshToken, isLoading: false, isDemoMode: false });
        } catch {
          // API not reachable — fall back to offline demo profile
          const fakeToken = `demo-token-${role}-${Date.now()}`;
          set({ user: DEMO_PROFILES[role], token: fakeToken, refreshToken: null, isLoading: false, isDemoMode: true });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          set({
            user: data.user,
            token: data.token,
            refreshToken: data.refreshToken,
            isLoading: false,
            isDemoMode: false,
          });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({ user: null, token: null, refreshToken: null, isDemoMode: false });
        delete api.defaults.headers.common['Authorization'];
      },

      refreshAuth: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;
        try {
          const { data } = await api.post('/auth/refresh', { refreshToken });
          set({ token: data.token });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        } catch {
          get().logout();
        }
      },

      updateUser: (updates) => {
        set(state => ({ user: state.user ? { ...state.user, ...updates } : null }));
      },
    }),
    {
      name: 'machliphon-auth',
      partialize: (state: AuthState) => ({
        token: state.token?.startsWith('demo-token-') ? null : state.token,
        refreshToken: state.token?.startsWith('demo-token-') ? null : state.refreshToken,
        user: state.token?.startsWith('demo-token-') ? null : state.user,
        isDemoMode: false,
      }),
    }
  )
);
