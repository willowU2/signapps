import axios, { AxiosInstance } from 'axios';

// Service-specific base URLs
export const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://127.0.0.1:3001/api/v1';
export const CONTAINERS_URL = process.env.NEXT_PUBLIC_CONTAINERS_URL || 'http://127.0.0.1:3002/api/v1';
export const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'http://127.0.0.1:3003/api/v1';
export const STORAGE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://127.0.0.1:3004/api/v1';
export const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://127.0.0.1:3005/api/v1';
export const SECURELINK_URL = process.env.NEXT_PUBLIC_SECURELINK_URL || 'http://127.0.0.1:3006/api/v1';
export const SCHEDULER_URL = process.env.NEXT_PUBLIC_SCHEDULER_URL || 'http://127.0.0.1:3007/api/v1';
export const METRICS_URL = process.env.NEXT_PUBLIC_METRICS_URL || 'http://127.0.0.1:3008/api/v1';
export const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://127.0.0.1:3009/api/v1';
export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || 'http://127.0.0.1:3010/api/v1';
export const CALENDAR_URL = process.env.NEXT_PUBLIC_CALENDAR_URL || 'http://127.0.0.1:3011/api/v1';
export const MAIL_URL = process.env.NEXT_PUBLIC_MAIL_URL || 'http://127.0.0.1:3012/api/v1';
export const MEET_URL = process.env.NEXT_PUBLIC_MEET_URL || 'http://127.0.0.1:3013/api/v1';
export const IT_ASSETS_URL = process.env.NEXT_PUBLIC_IT_ASSETS_URL || 'http://127.0.0.1:3015/api/v1';
export const PXE_URL = process.env.NEXT_PUBLIC_PXE_URL || 'http://127.0.0.1:3016/api/v1';
export const REMOTE_URL = process.env.NEXT_PUBLIC_REMOTE_URL || 'http://127.0.0.1:3017/api/v1';

// Create axios instance with auth interceptors
export function createApiClient(baseURL: string): AxiosInstance {
    const client = axios.create({
        baseURL,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // Request interceptor to add auth token
    client.interceptors.request.use((config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('access_token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    });

    // Response interceptor for token refresh
    client.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;

            if (error.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;

                if (typeof window !== 'undefined') {
                    const refreshToken = localStorage.getItem('refresh_token');
                    if (!refreshToken) {
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('auth-storage');
                        document.cookie = 'auth-storage=; path=/; max-age=0';
                        window.location.href = '/login';
                        return Promise.reject(error);
                    }

                    try {
                        const response = await axios.post(`${IDENTITY_URL}/auth/refresh`, {
                            refresh_token: refreshToken,
                        });

                        const { access_token, refresh_token } = response.data;
                        localStorage.setItem('access_token', access_token);
                        localStorage.setItem('refresh_token', refresh_token);

                        originalRequest.headers.Authorization = `Bearer ${access_token}`;
                        return client(originalRequest);
                    } catch (refreshError) {
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                        localStorage.removeItem('auth-storage');
                        document.cookie = 'auth-storage=; path=/; max-age=0';
                        window.location.href = '/login';
                        return Promise.reject(refreshError);
                    }
                }
            }

            return Promise.reject(error);
        }
    );

    return client;
}

// API clients for each service
export const identityApiClient = createApiClient(IDENTITY_URL);
export const containersApiClient = createApiClient(CONTAINERS_URL);
export const proxyApiClient = createApiClient(PROXY_URL);
export const storageApiClient = createApiClient(STORAGE_URL);
export const aiApiClient = createApiClient(AI_URL);
export const securelinkApiClient = createApiClient(SECURELINK_URL);
export const schedulerApiClient = createApiClient(SCHEDULER_URL);
export const metricsApiClient = createApiClient(METRICS_URL);
export const mediaApiClient = createApiClient(MEDIA_URL);
export const docsApiClient = createApiClient(DOCS_URL);
export const calendarApiClient = createApiClient(CALENDAR_URL);
export const mailApiClient = createApiClient(MAIL_URL);
export const meetApiClient = createApiClient(MEET_URL);
export const itAssetsApiClient = createApiClient(IT_ASSETS_URL);
export const pxeApiClient = createApiClient(PXE_URL);
export const remoteApiClient = createApiClient(REMOTE_URL);

// Legacy api export for compatibility (aliased to identity for auth calls)
export const api = identityApiClient;
