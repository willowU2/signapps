import axios, { AxiosInstance } from "axios";
import { useEntityStore } from "@/stores/entity-hub-store";

// Single gateway entry point — all HTTP services route through port 3099.
// Set NEXT_PUBLIC_GATEWAY_URL in .env.local to override for production.
// Strip /api/v1 suffix if accidentally included so the URL is always correct.
export const GATEWAY_URL = (
  process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3099"
).replace(/\/api\/v1\/?$/, "");

// All HTTP service URLs route through the gateway by default.
// The gateway forwards to the correct backend by path prefix:
//   /api/v1/auth   → identity (port 3001)
//   /api/v1/calendar → calendar (port 3011)
//   etc.
// Per-service overrides via NEXT_PUBLIC_*_URL are preserved for local dev/tests.
const GW = `${GATEWAY_URL}/api/v1`;
export const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL || GW;
export const CONTAINERS_URL = process.env.NEXT_PUBLIC_CONTAINERS_URL || GW;
export const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || GW;
export const STORAGE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || GW;
export const AI_URL = process.env.NEXT_PUBLIC_AI_URL || GW;
export const SECURELINK_URL = process.env.NEXT_PUBLIC_SECURELINK_URL || GW;
export const SCHEDULER_URL = process.env.NEXT_PUBLIC_SCHEDULER_URL || GW;
export const METRICS_URL = process.env.NEXT_PUBLIC_METRICS_URL || GW;
export const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || GW;
export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || GW;
export const CALENDAR_URL = process.env.NEXT_PUBLIC_CALENDAR_URL || GW;
export const MAIL_URL = process.env.NEXT_PUBLIC_MAIL_URL || GW;
export const MEET_URL = process.env.NEXT_PUBLIC_MEET_URL || GW;
export const IT_ASSETS_URL = process.env.NEXT_PUBLIC_IT_ASSETS_URL || GW;
export const PXE_URL = process.env.NEXT_PUBLIC_PXE_URL || GW;
export const REMOTE_URL = process.env.NEXT_PUBLIC_REMOTE_URL || GW;
export const CHAT_URL = process.env.NEXT_PUBLIC_CHAT_URL || GW;
export const OFFICE_URL = process.env.NEXT_PUBLIC_OFFICE_URL || GW;
export const SOCIAL_URL = process.env.NEXT_PUBLIC_SOCIAL_URL || GW;
export const CONTACTS_URL = process.env.NEXT_PUBLIC_CONTACTS_URL || GW;
export const FORMS_URL = process.env.NEXT_PUBLIC_FORMS_URL || GW;
export const NOTIFICATIONS_URL =
  process.env.NEXT_PUBLIC_NOTIFICATIONS_URL || GW;
export const BILLING_URL = process.env.NEXT_PUBLIC_BILLING_URL || GW;
export const API_URL = process.env.NEXT_PUBLIC_API_URL || GW;

// WebSocket URLs — kept direct, not routable through HTTP gateway
export const COLLAB_WS_URL =
  process.env.NEXT_PUBLIC_COLLAB_WS_URL || "ws://localhost:3013";
export const COLLAB_URL =
  process.env.NEXT_PUBLIC_COLLAB_URL || "ws://localhost:3010";
export const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";

// Feature flags and third-party keys
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
export const GOOGLE_FONTS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY || "";
export const COLLAB_ENABLED = process.env.NEXT_PUBLIC_COLLAB_ENABLED === "true";

// Create axios instance with auth interceptors
export function createApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 10_000, // 10s timeout — prevents hanging when services are down
    headers: {
      "Content-Type": "application/json",
    },
    withCredentials: true,
  });

  // Request interceptor - cookies sent via withCredentials, add workspace context
  client.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
      // Dynamically inject the active workspace from Zustand state
      const workspaceId = useEntityStore.getState().selectedWorkspaceId;
      if (workspaceId) {
        config.headers["X-Workspace-ID"] = workspaceId;
      }
    }
    return config;
  });

  // Non-critical paths that should silently fail on 401/403
  const SILENT_PATHS = [
    "/users/me/profile",
    "/users/me/history",
    "/users/me/preferences",
    "/users/me/recent-docs",
    "/users/me/streak",
    "/users/me/export",
    "/activities",
    "/workspaces/mine",
    "/workspaces",
    "/links",
    "/audit",
    "/notifications",
    "/health",
  ];
  const isSilentPath = (url?: string) =>
    url ? SILENT_PATHS.some((p) => url.includes(p)) : false;

  // Response interceptor for token refresh
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      const status = error.response?.status;
      const requestUrl = originalRequest?.url || "";

      // Silently reject non-critical paths on 401/403
      if ((status === 401 || status === 403) && isSilentPath(requestUrl)) {
        return Promise.reject(error);
      }

      // 403 = authenticated but forbidden, don't redirect
      if (status === 403) {
        return Promise.reject(error);
      }

      if (
        status === 401 &&
        !originalRequest._retry &&
        !requestUrl.includes("/auth/login") &&
        !requestUrl.includes("/auth/refresh")
      ) {
        originalRequest._retry = true;

        if (typeof window !== "undefined") {
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
            localStorage.removeItem("auth-storage");
            if (!window.location.pathname.startsWith("/login")) {
              window.location.href = "/login";
            }
            return Promise.reject(refreshError);
          }
        }
      }

      return Promise.reject(error);
    },
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
export const chatApiClient = createApiClient(CHAT_URL);
export const officeApiClient = createApiClient(OFFICE_URL);
export const socialApiClient = createApiClient(SOCIAL_URL);
export const notificationsApiClient = createApiClient(NOTIFICATIONS_URL);
export const formsApiClient = createApiClient(FORMS_URL);
export const contactsApiClient = createApiClient(CONTACTS_URL);
export const billingApiClient = createApiClient(BILLING_URL);

// Legacy api export for compatibility (aliased to identity for auth calls)
export const api = identityApiClient;
