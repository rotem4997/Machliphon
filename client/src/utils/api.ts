import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
      originalRequest._retry = true;
      try {
        const stored = localStorage.getItem('machliphon-auth');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.state?.refreshToken) {
            const { data } = await axios.post('/api/auth/refresh', { refreshToken: parsed.state.refreshToken });
            // Update token in persisted store so subsequent requests use it
            parsed.state.token = data.token;
            localStorage.setItem('machliphon-auth', JSON.stringify(parsed));
            originalRequest.headers.Authorization = `Bearer ${data.token}`;
            return api(originalRequest);
          }
        }
      } catch {}
      // Redirect to login
      localStorage.removeItem('machliphon-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
