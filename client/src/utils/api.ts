import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

/**
 * Structured error response from the server.
 */
export interface ApiErrorResponse {
  error: string;        // Hebrew user-friendly message
  errorCode: string;    // Machine-readable code for branching
  requestId?: string;   // Correlates with server logs
  timestamp: string;
  debug?: {
    code: string;
    source: string;
    detail: string;
    meta?: Record<string, unknown>;
  };
}

/**
 * Extract a user-friendly error message from an Axios error.
 */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError<ApiErrorResponse>;
    // Server returned a structured error (ensure it's a string, not an object)
    const serverError = axErr.response?.data?.error;
    if (typeof serverError === 'string') {
      return serverError;
    }
    // Network / timeout
    if (axErr.code === 'ECONNABORTED') return 'הבקשה ארכה יותר מדי זמן. נסה שנית.';
    if (!axErr.response) return 'אין חיבור לשרת. בדוק את החיבור לאינטרנט.';
    // HTTP status fallbacks
    if (axErr.response.status === 429) return 'יותר מדי בקשות. נסה שנית בעוד מעט.';
    if (axErr.response.status >= 500) return 'שגיאת שרת. אנא נסה שנית.';
  }
  return 'אירעה שגיאה. אנא נסה שנית.';
}

/**
 * Get the debug info from an Axios error (for console logging).
 */
export function getDebugInfo(err: unknown): ApiErrorResponse['debug'] | null {
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError<ApiErrorResponse>;
    return axErr.response?.data?.debug || null;
  }
  return null;
}

/**
 * Get the request ID from an error (for support tickets / log correlation).
 */
export function getRequestId(err: unknown): string | undefined {
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError<ApiErrorResponse>;
    return axErr.response?.data?.requestId || axErr.response?.headers?.['x-request-id'];
  }
  return undefined;
}

/**
 * Show a user-friendly toast for an API error.
 * Logs full debug info to console for agent/developer debugging.
 */
export function handleApiError(err: unknown, context?: string) {
  const message = getErrorMessage(err);
  const debug = getDebugInfo(err);
  const requestId = getRequestId(err);

  // User-friendly toast
  toast.error(message);

  // Structured console log for debugging / agent fixing
  console.error(
    `[API_ERROR]${context ? ` [${context}]` : ''}`,
    JSON.stringify({
      userMessage: message,
      requestId,
      errorCode: axios.isAxiosError(err) ? (err as AxiosError<ApiErrorResponse>).response?.data?.errorCode : undefined,
      status: axios.isAxiosError(err) ? (err as AxiosError<ApiErrorResponse>).response?.status : undefined,
      debug,
      url: axios.isAxiosError(err) ? err.config?.url : undefined,
      method: axios.isAxiosError(err) ? err.config?.method : undefined,
    }, null, 2)
  );
}

// Always use relative /api so the Vercel rewrite proxy handles routing to
// the backend (server-to-server, no CORS). In dev, Vite proxies instead.
// Set VITE_API_URL to override for non-Vercel deployments.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// 60s accommodates Render free-tier cold starts (~30-60s) so the first
// request after the backend goes to sleep doesn't time out.
const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token on every request
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('machliphon-auth');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    } catch {}
  }
  return config;
});

// Handle 401 — try to refresh the access token, but only logout if the refresh
// itself returns 401 (token actually invalid). Network errors / timeouts during
// refresh must NOT wipe the user's auth, otherwise a single hiccup logs them out
// and they end up back at /login while their tokens are still good.
//
// Also, never run the refresh flow for the login or refresh endpoints
// themselves — login 401 is "wrong credentials", refresh 401 is "session over".
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url: string = originalRequest?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      const stored = localStorage.getItem('machliphon-auth');
      if (!stored) {
        return Promise.reject(error);
      }

      let parsed: { state?: { refreshToken?: string; token?: string } };
      try {
        parsed = JSON.parse(stored);
      } catch {
        return Promise.reject(error);
      }
      if (!parsed.state?.refreshToken) {
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${API_BASE}/auth/refresh`,
          { refreshToken: parsed.state.refreshToken },
          { timeout: 60000 },
        );
        parsed.state.token = data.token;
        localStorage.setItem('machliphon-auth', JSON.stringify(parsed));
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return api(originalRequest);
      } catch (refreshErr: unknown) {
        // Only clear auth if the refresh endpoint itself rejected the token.
        // Network errors / timeouts leave auth intact so the user can retry.
        const refreshStatus = axios.isAxiosError(refreshErr)
          ? refreshErr.response?.status
          : undefined;
        if (refreshStatus === 401 || refreshStatus === 403) {
          localStorage.removeItem('machliphon-auth');
        }
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
