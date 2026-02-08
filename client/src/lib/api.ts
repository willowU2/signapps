import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (username: string, password: string, rememberMe?: boolean) =>
    api.post<LoginResponse>('/auth/login', { username, password, remember_me: rememberMe }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<User>('/auth/me'),

  refresh: (refreshToken: string) =>
    api.post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken }),

  // MFA/2FA endpoints
  mfaVerify: (mfaSessionToken: string, code: string) =>
    api.post<LoginResponse>('/auth/mfa/verify', { mfa_session_token: mfaSessionToken, code }),

  mfaSetup: () => api.post<MfaSetupResponse>('/auth/mfa/setup'),

  // LDAP/AD authentication
  ldapLogin: (username: string, password: string, rememberMe?: boolean) =>
    api.post<LoginResponse>('/auth/ldap/login', { username, password, remember_me: rememberMe }),
};

// Auth response types
export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  user?: User;
  mfa_required: boolean;
  mfa_session_token?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface MfaSetupResponse {
  secret: string;
  qr_code_url: string;
  backup_codes: string[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  display_name?: string;
  role: number;
  mfa_enabled: boolean;
  auth_provider: 'local' | 'ldap';
}

// Containers API
export const containersApi = {
  list: () => api.get('/containers'),
  get: (id: string) => api.get(`/containers/${id}`),
  create: (data: CreateContainerRequest) => api.post('/containers', data),
  start: (id: string) => api.post(`/containers/${id}/start`),
  stop: (id: string) => api.post(`/containers/${id}/stop`),
  restart: (id: string) => api.post(`/containers/${id}/restart`),
  remove: (id: string) => api.delete(`/containers/${id}`),
  logs: (id: string) => api.get(`/containers/${id}/logs`),
  stats: (id: string) => api.get(`/containers/${id}/stats`),
};

// Storage API
export const storageApi = {
  listBuckets: () => api.get('/buckets'),
  listFiles: (bucket: string, prefix?: string) =>
    api.get(`/files/${bucket}`, { params: { prefix } }),
  upload: (bucket: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/files/${bucket}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  download: (bucket: string, key: string) =>
    api.get(`/files/${bucket}/${key}`, { responseType: 'blob' }),
  delete: (bucket: string, key: string) =>
    api.delete(`/files/${bucket}/${key}`),
};

// AI API
export const aiApi = {
  chat: (query: string, conversationId?: string) =>
    api.post('/ai/chat', { query, conversation_id: conversationId }),
  search: (query: string, limit?: number) =>
    api.get('/ai/search', { params: { q: query, limit } }),
  index: (content: string, filename: string, path: string) =>
    api.post('/ai/index', { content, filename, path }),
  stats: () => api.get('/ai/stats'),
};

// Routes API
export const routesApi = {
  list: () => api.get('/routes'),
  get: (id: string) => api.get(`/routes/${id}`),
  create: (data: CreateRouteRequest) => api.post('/routes', data),
  update: (id: string, data: Partial<CreateRouteRequest>) =>
    api.put(`/routes/${id}`, data),
  delete: (id: string) => api.delete(`/routes/${id}`),
};

// Users API
export const usersApi = {
  list: (page?: number, limit?: number) =>
    api.get('/users', { params: { page, limit } }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: CreateUserRequest) => api.post('/users', data),
  update: (id: string, data: Partial<CreateUserRequest>) =>
    api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// Metrics API
export const metricsApi = {
  system: () => api.get('/metrics/system'),
  health: () => api.get('/health'),
};

// Types
export interface CreateContainerRequest {
  name: string;
  image: string;
  ports?: Record<string, string>;
  env?: Record<string, string>;
  volumes?: string[];
}

export interface CreateRouteRequest {
  name: string;
  host: string;
  target: string;
  tls_enabled?: boolean;
  auth_required?: boolean;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  display_name?: string;
  role?: number;
}
