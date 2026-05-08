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
  loginDemo: (role: 'authority_admin' | 'manager' | 'substitute') => Promise<void>;
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

      loginDemo: async (role) => {
        const creds: Record<string, { email: string; password: string }> = {
          authority_admin: { email: 'director@yokneam.muni.il', password: 'Demo1234!' },
          manager:         { email: 'manager@yokneam.muni.il',  password: 'Demo1234!' },
          substitute:      { email: 'miriam@example.com',        password: 'Demo1234!' },
        };
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', creds[role]);
          set({ user: data.user, token: data.token, refreshToken: data.refreshToken, isLoading: false });
        } catch {
          // DB not available — set a UI-only session (API calls will fail with 401)
          set({ isLoading: false });
          throw new Error('שרת הדמו אינו זמין. אנא נסה להיכנס עם אימייל וסיסמה.');
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
      partialize: (state: AuthState) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
