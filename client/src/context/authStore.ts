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

  login: (email: string, password: string) => Promise<void>;
  loginDemo: (role: 'authority_admin' | 'manager' | 'substitute') => void;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,

      loginDemo: (role) => {
        const profiles: Record<string, User> = {
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
        set({ user: profiles[role], token: `demo-token-${role}-${Date.now()}`, refreshToken: null });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          set({ 
            user: data.user, 
            token: data.token, 
            refreshToken: data.refreshToken,
            isLoading: false 
          });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({ user: null, token: null, refreshToken: null });
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
      // Never persist demo sessions — they should last only for the browser session.
      partialize: (state: AuthState) => {
        if (state.token?.startsWith('demo-token-')) {
          return { token: null, refreshToken: null, user: null };
        }
        return { token: state.token, refreshToken: state.refreshToken, user: state.user };
      },
    }
  )
);
