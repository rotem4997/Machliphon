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

// Always use relative /api — in dev Vite proxies to localhost:3001,
// in production Vercel routes /api/* to the backend via vercel.json.
// Set VITE_API_URL only for non-Vercel custom deployments.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
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

// Handle 401 - refresh or logout
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Never log out a demo session — just swallow the 401
      const stored = localStorage.getItem('machliphon-auth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.state?.token?.startsWith('demo-token-')) {
            return Promise.reject(error);
          }
        } catch {}
      }

      originalRequest._retry = true;
      try {
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.state?.refreshToken) {
            const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: parsed.state.refreshToken });
            parsed.state.token = data.token;
            localStorage.setItem('machliphon-auth', JSON.stringify(parsed));
            originalRequest.headers.Authorization = `Bearer ${data.token}`;
            return api(originalRequest);
          }
        }
      } catch {}
      localStorage.removeItem('machliphon-auth');
    }
    return Promise.reject(error);
  }
);

export default api;
