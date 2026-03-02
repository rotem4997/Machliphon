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
        window.location.href = '/login';
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
      partialState: (state) => ({ token: state.token, refreshToken: state.refreshToken, user: state.user }),
    }
  )
);
