import axios, { AxiosInstance } from 'axios';
import { useEntityStore } from '@/stores/entity-hub-store';

// Service-specific base URLs
export const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://localhost:3001/api/v1';
export const CONTAINERS_URL = process.env.NEXT_PUBLIC_CONTAINERS_URL || 'http://localhost:3002/api/v1';
export const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:3003/api/v1';
export const STORAGE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:3004/api/v1';
export const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';
export const SECURELINK_URL = process.env.NEXT_PUBLIC_SECURELINK_URL || 'http://localhost:3006/api/v1';
export const SCHEDULER_URL = process.env.NEXT_PUBLIC_SCHEDULER_URL || 'http://localhost:3007/api/v1';
export const METRICS_URL = process.env.NEXT_PUBLIC_METRICS_URL || 'http://localhost:3008/api/v1';
export const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:3009/api/v1';
export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || 'http://localhost:3010/api/v1';
export const CALENDAR_URL = process.env.NEXT_PUBLIC_CALENDAR_URL || 'http://localhost:3011/api/v1';
export const MAIL_URL = process.env.NEXT_PUBLIC_MAIL_URL || 'http://localhost:3012/api/v1';
export const MEET_URL = process.env.NEXT_PUBLIC_MEET_URL || 'http://localhost:3014/api/v1';
export const IT_ASSETS_URL = process.env.NEXT_PUBLIC_IT_ASSETS_URL || 'http://localhost:3015/api/v1';
export const PXE_URL = process.env.NEXT_PUBLIC_PXE_URL || 'http://localhost:3016/api/v1';
export const REMOTE_URL = process.env.NEXT_PUBLIC_REMOTE_URL || 'http://localhost:3017/api/v1';

// Create axios instance with auth interceptors
export function createApiClient(baseURL: string): AxiosInstance {
    const client = axios.create({
        baseURL,
        timeout: 10_000, // 10s timeout — prevents hanging when services are down
        headers: {
            'Content-Type': 'application/json',
        },
        withCredentials: true,
    });

    // Request interceptor - cookies sent via withCredentials, add workspace context
    client.interceptors.request.use((config) => {
        if (typeof window !== 'undefined') {
            // Dynamically inject the active workspace from Zustand state
            const workspaceId = useEntityStore.getState().selectedWorkspaceId;
            if (workspaceId) {
                config.headers['X-Workspace-ID'] = workspaceId;
            }
        }
        return config;
    });

    // Non-critical paths that should silently fail on 401/403
    const SILENT_PATHS = [
        '/users/me/profile', '/users/me/history', '/users/me/preferences',
        '/activities', '/workspaces/mine', '/workspaces', '/links',
        '/audit', '/notifications',
    ];
    const isSilentPath = (url?: string) => url ? SILENT_PATHS.some(p => url.includes(p)) : false;

    // Response interceptor for token refresh
    client.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            const status = error.response?.status;
            const requestUrl = originalRequest?.url || '';

            // Silently reject non-critical paths on 401/403
            if ((status === 401 || status === 403) && isSilentPath(requestUrl)) {
                return Promise.reject(error);
            }

            // 403 = authenticated but forbidden, don't redirect
            if (status === 403) {
                return Promise.reject(error);
            }

            if (status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;

                if (typeof window !== 'undefined') {
                    // Make a refresh call which will automatically include the refresh_token cookie
                    try {
                        await axios.post(`${IDENTITY_URL}/auth/refresh`, null, {
                            withCredentials: true,
                        });

                        // Retry original request (the cookie is now updated)
                        return client(originalRequest);
                    } catch (refreshError) {
                        if (isSilentPath(requestUrl)) {
                            return Promise.reject(refreshError);
                        }
                        localStorage.removeItem('auth-storage');
                        if (!window.location.pathname.startsWith('/login')) {
                            window.location.href = '/login';
                        }
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
