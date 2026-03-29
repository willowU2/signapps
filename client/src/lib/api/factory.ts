/**
 * API Client Factory - SignApps Platform
 *
 * Factory centralisée pour créer des clients API avec:
 * - Configuration unifiée des services
 * - Intercepteurs JWT auto-refresh
 * - Gestion d'erreurs cohérente
 * - Support des health checks
 *
 * Usage:
 *   import { getClient, ServiceName } from '@/lib/api/factory';
 *   const client = getClient('identity');
 *   // ou
 *   const client = getClient(ServiceName.IDENTITY);
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useEntityStore } from '@/stores/entity-hub-store';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export enum ServiceName {
  IDENTITY = 'identity',
  CONTAINERS = 'containers',
  PROXY = 'proxy',
  STORAGE = 'storage',
  AI = 'ai',
  SECURELINK = 'securelink',
  SCHEDULER = 'scheduler',
  METRICS = 'metrics',
  MEDIA = 'media',
  DOCS = 'docs',
  CALENDAR = 'calendar',
  MAIL = 'mail',
  COLLAB = 'collab',
  MEET = 'meet',
  IT_ASSETS = 'it-assets',
  PXE = 'pxe',
  REMOTE = 'remote',
  OFFICE = 'office',
  WORKFORCE = 'workforce',
  CONTACTS = 'contacts',
  FORMS = 'forms',
  CHAT = 'chat',
  SOCIAL = 'social',
  NOTIFICATIONS = 'notifications',
  BILLING = 'billing',
}

interface ServiceConfig {
  port: number;
  envVar: string;
  healthPath?: string;
}

const SERVICE_CONFIG: Record<ServiceName, ServiceConfig> = {
  [ServiceName.IDENTITY]: { port: 3001, envVar: 'NEXT_PUBLIC_IDENTITY_URL', healthPath: '/health' },
  [ServiceName.CONTAINERS]: { port: 3002, envVar: 'NEXT_PUBLIC_CONTAINERS_URL', healthPath: '/health' },
  [ServiceName.PROXY]: { port: 3003, envVar: 'NEXT_PUBLIC_PROXY_URL', healthPath: '/health' },
  [ServiceName.STORAGE]: { port: 3004, envVar: 'NEXT_PUBLIC_STORAGE_URL', healthPath: '/health' },
  [ServiceName.AI]: { port: 3005, envVar: 'NEXT_PUBLIC_AI_URL', healthPath: '/health' },
  [ServiceName.SECURELINK]: { port: 3006, envVar: 'NEXT_PUBLIC_SECURELINK_URL', healthPath: '/health' },
  [ServiceName.SCHEDULER]: { port: 3007, envVar: 'NEXT_PUBLIC_SCHEDULER_URL', healthPath: '/health' },
  [ServiceName.METRICS]: { port: 3008, envVar: 'NEXT_PUBLIC_METRICS_URL', healthPath: '/health' },
  [ServiceName.MEDIA]: { port: 3009, envVar: 'NEXT_PUBLIC_MEDIA_URL', healthPath: '/health' },
  [ServiceName.DOCS]: { port: 3010, envVar: 'NEXT_PUBLIC_DOCS_URL', healthPath: '/health' },
  [ServiceName.CALENDAR]: { port: 3011, envVar: 'NEXT_PUBLIC_CALENDAR_URL', healthPath: '/health' },
  [ServiceName.MAIL]: { port: 3012, envVar: 'NEXT_PUBLIC_MAIL_URL', healthPath: '/health' },
  [ServiceName.COLLAB]: { port: 3013, envVar: 'NEXT_PUBLIC_COLLAB_URL', healthPath: '/health' },
  [ServiceName.MEET]: { port: 3014, envVar: 'NEXT_PUBLIC_MEET_URL', healthPath: '/health' },
  [ServiceName.IT_ASSETS]: { port: 3015, envVar: 'NEXT_PUBLIC_IT_ASSETS_URL', healthPath: '/health' },
  [ServiceName.PXE]: { port: 3016, envVar: 'NEXT_PUBLIC_PXE_URL', healthPath: '/health' },
  [ServiceName.REMOTE]: { port: 3017, envVar: 'NEXT_PUBLIC_REMOTE_URL', healthPath: '/health' },
  [ServiceName.OFFICE]: { port: 3018, envVar: 'NEXT_PUBLIC_OFFICE_URL', healthPath: '/health' },
  [ServiceName.WORKFORCE]: { port: 3019, envVar: 'NEXT_PUBLIC_WORKFORCE_URL', healthPath: '/health' },
  [ServiceName.CONTACTS]: { port: 3021, envVar: 'NEXT_PUBLIC_CONTACTS_URL', healthPath: '/health' },
  [ServiceName.FORMS]: { port: 3015, envVar: 'NEXT_PUBLIC_FORMS_URL', healthPath: '/health' },
  [ServiceName.CHAT]: { port: 3020, envVar: 'NEXT_PUBLIC_CHAT_URL', healthPath: '/health' },
  [ServiceName.SOCIAL]: { port: 3019, envVar: 'NEXT_PUBLIC_SOCIAL_URL', healthPath: '/health' },
  [ServiceName.NOTIFICATIONS]: { port: 8095, envVar: 'NEXT_PUBLIC_NOTIFICATIONS_URL', healthPath: '/health' },
  [ServiceName.BILLING]: { port: 8096, envVar: 'NEXT_PUBLIC_BILLING_URL', healthPath: '/health' },
};

// ═══════════════════════════════════════════════════════════════════════════
// URL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupère l'URL de base d'un service
 */
export function getServiceUrl(service: ServiceName): string {
  const config = SERVICE_CONFIG[service];
  const envValue = typeof window !== 'undefined'
    ? (process.env[config.envVar] || null)
    : process.env[config.envVar];

  return envValue || `http://localhost:${config.port}/api/v1`;
}

/**
 * Récupère l'URL de base brute (sans /api/v1) d'un service
 */
export function getServiceBaseUrl(service: ServiceName): string {
  const config = SERVICE_CONFIG[service];
  const envValue = typeof window !== 'undefined'
    ? (process.env[config.envVar] || null)
    : process.env[config.envVar];

  if (envValue) {
    // Remove /api/v1 suffix if present
    return envValue.replace(/\/api\/v1\/?$/, '');
  }
  return `http://localhost:${config.port}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT CACHE
// ═══════════════════════════════════════════════════════════════════════════

const clientCache = new Map<ServiceName, AxiosInstance>();

// ═══════════════════════════════════════════════════════════════════════════
// INTERCEPTORS
// ═══════════════════════════════════════════════════════════════════════════

let refreshPromise: Promise<void> | null = null;

/**
 * Non-critical API paths that should NOT trigger error toasts or login redirects
 * on 401/403. These endpoints are called on initial page load and may fail
 * legitimately when the backend hasn't been set up yet.
 */
const SILENT_AUTH_PATHS = [
  '/users/me/profile',
  '/users/me/history',
  '/users/me/preferences',
  '/users/me/recent-docs',
  '/users/me/streak',
  '/users/me/export',
  '/activities',
  '/workspaces/mine',
  '/workspaces',
  '/links',
  '/audit',
  '/notifications',
  '/health',
];

/**
 * Check if a request URL matches a non-critical path that should be silenced on auth errors
 */
function isSilentAuthPath(url?: string): boolean {
  if (!url) return false;
  return SILENT_AUTH_PATHS.some(path => url.includes(path));
}

// ═══════════════════════════════════════════════════════════════════════════
// USER-FRIENDLY ERROR MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps HTTP status codes and network errors to user-facing French messages.
 * These replace the generic "Une erreur est survenue" with actionable text.
 */
export function getHumanErrorMessage(error: AxiosError): string {
  // Network-level errors (no response at all)
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'Le serveur met trop de temps à répondre. Réessayez dans quelques instants.';
    }
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      return 'Impossible de contacter le serveur. Vérifiez votre connexion.';
    }
    return 'Impossible de contacter le serveur. Vérifiez votre connexion.';
  }

  const status = error.response.status;

  switch (status) {
    case 400:
      return 'Requête invalide. Vérifiez les données saisies.';
    case 401:
      return 'Votre session a expiré. Veuillez vous reconnecter.';
    case 403:
      return 'Vous n\'avez pas les permissions nécessaires.';
    case 404:
      return 'La ressource demandée n\'existe pas.';
    case 408:
      return 'Le serveur met trop de temps à répondre. Réessayez dans quelques instants.';
    case 409:
      return 'Conflit : cette ressource a été modifiée par un autre utilisateur.';
    case 413:
      return 'Le fichier envoyé est trop volumineux.';
    case 422:
      return 'Les données envoyées sont invalides. Vérifiez le formulaire.';
    case 429:
      return 'Trop de requêtes. Veuillez patienter avant de réessayer.';
    case 500:
      return 'Erreur interne du serveur. Réessayez dans quelques instants.';
    case 502:
      return 'Le serveur est temporairement indisponible. Réessayez dans quelques instants.';
    case 503:
      return 'Service en maintenance. Réessayez dans quelques instants.';
    case 504:
      return 'Le serveur ne répond pas. Réessayez dans quelques instants.';
    default:
      if (status >= 500) {
        return 'Erreur interne du serveur. Réessayez dans quelques instants.';
      }
      return `Erreur inattendue (${status}). Réessayez dans quelques instants.`;
  }
}

function addAuthHeader(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  // Cookies are automatically sent via withCredentials: true
  // Add workspace context header
  if (typeof window !== 'undefined') {
    const workspaceId = useEntityStore.getState().selectedWorkspaceId;
    if (workspaceId) {
      config.headers['X-Workspace-ID'] = workspaceId;
    }
  }
  return config;
}

async function handleAuthError(error: AxiosError, client: AxiosInstance): Promise<any> {
  const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
  const status = error.response?.status;
  const requestUrl = originalRequest?.url || '';

  // For non-critical paths, silently reject 401/403 without redirect or retry
  if ((status === 401 || status === 403) && isSilentAuthPath(requestUrl)) {
    return Promise.reject(error);
  }

  // For 403 errors on any path, reject without redirect (user is authenticated but lacks permission)
  if (status === 403) {
    return Promise.reject(error);
  }

  if (status === 401 && !originalRequest._retry) {
    originalRequest._retry = true;

    if (typeof window !== 'undefined') {
      try {
        // Prevent race condition: only one refresh at a time
        if (!refreshPromise) {
          const identityUrl = getServiceUrl(ServiceName.IDENTITY);
          refreshPromise = axios.post(`${identityUrl}/auth/refresh`, null, {
            withCredentials: true,
          }).then(() => {}).finally(() => {
            refreshPromise = null;
          });
        }

        await refreshPromise;

        // Retry original request (the cookie is now updated)
        return client(originalRequest);
      } catch (refreshError) {
        // Don't redirect for non-critical paths even on refresh failure
        if (isSilentAuthPath(requestUrl)) {
          return Promise.reject(refreshError);
        }
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      }
    }
  }

  return Promise.reject(error);
}

function clearAuthAndRedirect(): void {
  localStorage.removeItem('auth-storage');
  document.cookie = 'auth-storage=; path=/; max-age=0';
  // Don't hard-redirect if already on login page (preserves query params like ?auto=admin)
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crée un client API pour un service donné
 * Les clients sont mis en cache pour réutilisation
 */
export function getClient(service: ServiceName): AxiosInstance {
  // Return cached client if exists
  const cached = clientCache.get(service);
  if (cached) return cached;

  const baseURL = getServiceUrl(service);

  const client = axios.create({
    baseURL,
    timeout: 10_000, // 10s timeout — prevents hanging when services are down
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });

  // Request interceptor
  client.interceptors.request.use(addAuthHeader);

  // Response interceptor — attach human-readable message then handle auth errors
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      // Attach a user-friendly message to every error so callers can use it
      if (error && !isSilentAuthPath(error.config?.url)) {
        (error as AxiosError & { humanMessage?: string }).humanMessage =
          getHumanErrorMessage(error);
      }
      return handleAuthError(error, client);
    }
  );

  // Cache the client
  clientCache.set(service, client);

  return client;
}

/**
 * Alias pour compatibilité avec le code existant
 */
export function createServiceClient(service: ServiceName): AxiosInstance {
  return getClient(service);
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

export interface HealthCheckResult {
  service: ServiceName;
  healthy: boolean;
  latency?: number;
  error?: string;
}

/**
 * Vérifie la santé d'un service
 */
export async function checkServiceHealth(service: ServiceName): Promise<HealthCheckResult> {
  const config = SERVICE_CONFIG[service];
  const baseUrl = getServiceBaseUrl(service);
  const healthUrl = `${baseUrl}${config.healthPath || '/health'}`;

  const start = Date.now();

  try {
    await axios.get(healthUrl, { timeout: 5000 });
    return {
      service,
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      service,
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Vérifie la santé de tous les services
 */
export async function checkAllServicesHealth(): Promise<HealthCheckResult[]> {
  const services = Object.values(ServiceName);
  return Promise.all(services.map(checkServiceHealth));
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS LEGACY (Compatibilité avec core.ts)
// ═══════════════════════════════════════════════════════════════════════════

// Ces exports permettent une migration progressive
export const identityClient = () => getClient(ServiceName.IDENTITY);
export const containersClient = () => getClient(ServiceName.CONTAINERS);
export const proxyClient = () => getClient(ServiceName.PROXY);
export const storageClient = () => getClient(ServiceName.STORAGE);
export const aiClient = () => getClient(ServiceName.AI);
export const securelinkClient = () => getClient(ServiceName.SECURELINK);
export const schedulerClient = () => getClient(ServiceName.SCHEDULER);
export const metricsClient = () => getClient(ServiceName.METRICS);
export const mediaClient = () => getClient(ServiceName.MEDIA);
export const docsClient = () => getClient(ServiceName.DOCS);
export const calendarClient = () => getClient(ServiceName.CALENDAR);
export const mailClient = () => getClient(ServiceName.MAIL);
export const collabClient = () => getClient(ServiceName.COLLAB);
export const meetClient = () => getClient(ServiceName.MEET);
export const officeClient = () => getClient(ServiceName.OFFICE);
export const workforceClient = () => getClient(ServiceName.WORKFORCE);
export const chatClient = () => getClient(ServiceName.CHAT);
