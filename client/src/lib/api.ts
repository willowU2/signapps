import axios, { AxiosInstance } from 'axios';

// Service-specific base URLs
const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://localhost:3001/api/v1';
const CONTAINERS_URL = process.env.NEXT_PUBLIC_CONTAINERS_URL || 'http://localhost:3002/api/v1';
const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:3003/api/v1';
const STORAGE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:3004/api/v1';
const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';
const SECURELINK_URL = process.env.NEXT_PUBLIC_SECURELINK_URL || 'http://localhost:3006/api/v1';
const SCHEDULER_URL = process.env.NEXT_PUBLIC_SCHEDULER_URL || 'http://localhost:3007/api/v1';
const METRICS_URL = process.env.NEXT_PUBLIC_METRICS_URL || 'http://localhost:3008/api/v1';
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:3009/api/v1';

// Create axios instance with auth interceptors
function createApiClient(baseURL: string): AxiosInstance {
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
const identityApi = createApiClient(IDENTITY_URL);
const containersApiClient = createApiClient(CONTAINERS_URL);
const proxyApiClient = createApiClient(PROXY_URL);
const storageApiClient = createApiClient(STORAGE_URL);
const aiApiClient = createApiClient(AI_URL);
const securelinkApiClient = createApiClient(SECURELINK_URL);
const schedulerApiClient = createApiClient(SCHEDULER_URL);
const metricsApiClient = createApiClient(METRICS_URL);
const mediaApiClient = createApiClient(MEDIA_URL);

// Legacy api export for compatibility
export const api = identityApi;

// Auth API
export const authApi = {
  login: (username: string, password: string, rememberMe?: boolean) =>
    identityApi.post<LoginResponse>('/auth/login', { username, password, remember_me: rememberMe }),

  logout: () => identityApi.post('/auth/logout'),

  me: () => identityApi.get<User>('/auth/me'),

  refresh: (refreshToken: string) =>
    identityApi.post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken }),

  // MFA/2FA endpoints
  mfaVerify: (mfaSessionToken: string, code: string) =>
    identityApi.post<LoginResponse>('/auth/mfa/verify', { mfa_session_token: mfaSessionToken, code }),

  mfaSetup: () => identityApi.post<MfaSetupResponse>('/auth/mfa/setup'),

  // LDAP/AD authentication
  ldapLogin: (username: string, password: string, rememberMe?: boolean) =>
    identityApi.post<LoginResponse>('/auth/ldap/login', { username, password, remember_me: rememberMe }),

  // LDAP configuration
  ldapGetConfig: () => identityApi.get<LdapConfig>('/auth/ldap/config'),
  ldapUpdateConfig: (config: Partial<LdapConfig>) =>
    identityApi.put<LdapConfig>('/auth/ldap/config', config),
  ldapTestConnection: () => identityApi.post<{ success: boolean; message: string }>('/auth/ldap/test'),
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

export interface LdapConfig {
  enabled: boolean;
  server_url: string;
  bind_dn: string;
  bind_password?: string;
  base_dn: string;
  user_filter?: string;
  group_filter?: string;
  admin_groups?: string[];
  user_groups?: string[];
  use_tls?: boolean;
  skip_tls_verify?: boolean;
  sync_interval_minutes?: number;
  fallback_local_auth?: boolean;
}

// App Store API
export const storeApi = {
  listApps: (params?: { search?: string; category?: string }) =>
    containersApiClient.get<StoreApp[]>('/store/apps', { params }),
  getAppDetails: (sourceId: string, appId: string) =>
    containersApiClient.get<AppDetails>(`/store/apps/${sourceId}/${encodeURIComponent(appId)}`),
  install: (data: StoreInstallRequest) =>
    containersApiClient.post('/store/install', data),
  installMulti: (data: MultiServiceInstallRequest) =>
    containersApiClient.post<InstallStartedResponse>('/store/install/multi', data),
  checkPorts: (ports: number[]) =>
    containersApiClient.get<PortConflict[]>('/store/check-ports', {
      params: { ports: ports.join(',') },
    }),
  validateSource: (data: { name: string; url: string }) =>
    containersApiClient.post<SourceValidation>('/store/sources/validate', data),
  listSources: () =>
    containersApiClient.get<AppSource[]>('/store/sources'),
  addSource: (data: { name: string; url: string }) =>
    containersApiClient.post<AppSource>('/store/sources', data),
  deleteSource: (id: string) =>
    containersApiClient.delete(`/store/sources/${id}`),
  refreshSource: (id: string) =>
    containersApiClient.post(`/store/sources/${id}/refresh`),
  refreshAll: () =>
    containersApiClient.post('/store/sources/refresh'),
};

/** Get the SSE URL for install progress. */
export function getInstallProgressUrl(installId: string): string {
  const base = CONTAINERS_URL.replace('/api/v1', '');
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';
  return `${base}/api/v1/store/install/${installId}/progress?token=${encodeURIComponent(token)}`;
}

export interface StoreApp {
  id: string;
  name: string;
  description: string;
  long_description: string;
  icon: string;
  tags: string[];
  supported_architectures: string[];
  compose_url: string;
  source_id: string;
  source_name: string;
  image: string;
  repository: string;
  other_sources?: { source_id: string; source_name: string }[];
  duplicate_count?: number;
}

export interface AppSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_fetched?: string;
  app_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface ParsedService {
  service_name: string;
  image: string;
  container_name?: string;
  restart: string;
  environment: { key: string; default?: string }[];
  ports: { host: number; container: number; protocol: string }[];
  volumes: { source: string; target: string; read_only: boolean }[];
  command?: string[];
  labels: Record<string, string>;
  hostname?: string;
  depends_on?: string[];
}

export interface AppDetails extends StoreApp {
  config: {
    services: ParsedService[];
  };
}

export interface StoreInstallRequest {
  app_id: string;
  source_id: string;
  container_name: string;
  environment?: Record<string, string>;
  ports?: { host: number; container: number; protocol?: string }[];
  volumes?: { source: string; target: string }[];
  labels?: Record<string, string>;
  auto_start?: boolean;
}

export interface MultiServiceInstallRequest {
  app_id: string;
  source_id: string;
  group_name: string;
  services: ServiceOverride[];
  auto_start?: boolean;
}

export interface ServiceOverride {
  service_name: string;
  container_name: string;
  environment?: Record<string, string>;
  ports?: { host: number; container: number; protocol?: string }[];
  volumes?: { source: string; target: string }[];
  labels?: Record<string, string>;
}

export interface InstallStartedResponse {
  install_id: string;
}

export interface InstallEvent {
  type: string;
  install_id?: string;
  service_count?: number;
  service_name?: string;
  image?: string;
  container_name?: string;
  message?: string;
}

export interface PortConflict {
  port: number;
  in_use: boolean;
  used_by?: string;
}

export interface SourceValidation {
  valid: boolean;
  app_count?: number;
  error?: string;
}

// Compose Import API
export const composeApi = {
  preview: (yaml: string) =>
    containersApiClient.post<ComposePreview>('/compose/preview', { yaml }),
  import: (yaml: string, autoStart?: boolean) =>
    containersApiClient.post<ContainerInfo[]>('/compose/import', {
      yaml,
      auto_start: autoStart,
    }),
};

export interface ComposePreview {
  services: ComposeServicePreview[];
}

export interface ComposeServicePreview {
  service_name: string;
  image: string;
  ports: { host: number; container: number; protocol: string }[];
  environment: { key: string; default?: string }[];
  volumes: { source: string; target: string }[];
}

// Containers API
export const containersApi = {
  list: () => containersApiClient.get<ContainerInfo[]>('/containers'),
  get: (id: string) => containersApiClient.get<ContainerInfo>(`/containers/${id}`),
  create: (data: CreateContainerRequest) => containersApiClient.post('/containers', data),
  start: (id: string) => containersApiClient.post(`/containers/${id}/start`),
  stop: (id: string) => containersApiClient.post(`/containers/${id}/stop`),
  restart: (id: string) => containersApiClient.post(`/containers/${id}/restart`),
  update: (id: string) => containersApiClient.post(`/containers/${id}/update`),
  remove: (id: string) => containersApiClient.delete(`/containers/${id}`),
  logs: (id: string, tail?: number) =>
    containersApiClient.get<string>(`/containers/${id}/logs`, { params: { tail } }),
  stats: (id: string) => containersApiClient.get(`/containers/${id}/stats`),
  // Docker-direct operations (for containers without DB records)
  startDocker: (dockerId: string) => containersApiClient.post(`/containers/docker/${dockerId}/start`),
  restartDocker: (dockerId: string) => containersApiClient.post(`/containers/docker/${dockerId}/restart`),
  logsDocker: (dockerId: string, tail?: number) =>
    containersApiClient.get<string>(`/containers/docker/${dockerId}/logs`, { params: { tail } }),
  statsDocker: (dockerId: string) => containersApiClient.get(`/containers/docker/${dockerId}/stats`),
  inspectDocker: (dockerId: string) => containersApiClient.get<ContainerInfo>(`/containers/docker/${dockerId}/inspect`),
  // Updates
  checkUpdate: (id: string) =>
    containersApiClient.post<CheckUpdateResponse>(`/containers/${id}/check-update`),
  setAutoUpdate: (id: string, autoUpdate: boolean) =>
    containersApiClient.put<{ auto_update: boolean }>(`/containers/${id}/auto-update`, {
      auto_update: autoUpdate,
    }),
  updatesStatus: () =>
    containersApiClient.get<UpdatesStatusResponse>('/updates/status'),
  // Images
  listImages: () => containersApiClient.get<ImageInfo[]>('/images'),
  pullImage: (image: string) => containersApiClient.post('/images/pull', { image }),
  removeImage: (id: string) => containersApiClient.delete(`/images/${id}`),
};

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: 'running' | 'stopped' | 'restarting' | 'paused' | 'exited';
  ports: PortMapping[];
  created: string;
  cpu_percent?: number;
  memory_usage?: number;
  memory_limit?: number;
  env?: string[];
  mounts?: DockerMountInfo[];
  cmd?: string[];
  entrypoint?: string[];
  working_dir?: string;
  hostname?: string;
  user?: string;
  restart_policy?: string;
  restart_count?: number;
  resources?: DockerResourceInfo;
  health?: DockerHealthInfo;
  labels?: Record<string, string>;
  networks?: string[];
}

export interface PortMapping {
  container_port: number;
  host_port?: number;
  host_ip?: string;
  protocol: string;
}

export interface DockerMountInfo {
  source?: string;
  destination: string;
  mount_type: string;
  rw: boolean;
}

export interface DockerResourceInfo {
  memory_limit?: number;
  nano_cpus?: number;
  cpu_shares?: number;
}

export interface DockerHealthInfo {
  status: string;
  failing_streak: number;
  test?: string[];
}

export interface CheckUpdateResponse {
  update_available: boolean;
  current_digest?: string;
  latest_digest?: string;
}

export interface UpdatesStatusResponse {
  containers: {
    id: string;
    name: string;
    image: string;
    auto_update: boolean;
    update_available?: boolean;
    last_checked?: string;
  }[];
}

export interface ImageInfo {
  id: string;
  repo_tags: string[];
  size: number;
  created: string;
}

// Backup types
export interface BackupProfile {
  id: string;
  name: string;
  container_ids: string[];
  schedule?: string;
  destination_type: string;
  destination_config: Record<string, unknown>;
  retention_policy?: RetentionPolicy;
  enabled: boolean;
  last_run_at?: string;
  owner_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RetentionPolicy {
  keep_last?: number;
  keep_daily?: number;
  keep_weekly?: number;
  keep_monthly?: number;
}

export interface BackupRun {
  id: string;
  profile_id: string;
  status: string;
  snapshot_id?: string;
  size_bytes?: number;
  files_new?: number;
  files_changed?: number;
  duration_seconds?: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

export interface BackupSnapshot {
  id: string;
  short_id: string;
  time: string;
  hostname: string;
  paths: string[];
  tags?: string[];
}

export interface CreateBackupProfileRequest {
  name: string;
  container_ids: string[];
  schedule?: string;
  destination_type: string;
  destination_config: Record<string, unknown>;
  retention_policy?: RetentionPolicy;
  password: string;
}

export const backupsApi = {
  list: () =>
    containersApiClient.get<{ profiles: BackupProfile[] }>('/backups'),
  get: (id: string) =>
    containersApiClient.get<BackupProfile>(`/backups/${id}`),
  create: (data: CreateBackupProfileRequest) =>
    containersApiClient.post<BackupProfile>('/backups', data),
  update: (id: string, data: Partial<BackupProfile>) =>
    containersApiClient.put<BackupProfile>(`/backups/${id}`, data),
  remove: (id: string) =>
    containersApiClient.delete(`/backups/${id}`),
  run: (id: string) =>
    containersApiClient.post<BackupRun>(`/backups/${id}/run`),
  snapshots: (id: string) =>
    containersApiClient.get<{ snapshots: BackupSnapshot[] }>(`/backups/${id}/snapshots`),
  restore: (id: string, snapshotId: string, targetPath?: string) =>
    containersApiClient.post(`/backups/${id}/restore`, {
      snapshot_id: snapshotId,
      target_path: targetPath,
    }),
  runs: (id: string) =>
    containersApiClient.get<{ runs: BackupRun[] }>(`/backups/${id}/runs`),
};

// Storage API
export const storageApi = {
  listBuckets: () => storageApiClient.get<Bucket[]>('/buckets'),
  createBucket: (name: string) => storageApiClient.post('/buckets', { name }),
  deleteBucket: (name: string) => storageApiClient.delete(`/buckets/${name}`),
  listFiles: (bucket: string, prefix?: string, delimiter?: string) =>
    storageApiClient.get<FileInfo[]>(`/files/${bucket}`, { params: { prefix, delimiter } }),
  upload: (bucket: string, file: File, path?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (path) formData.append('path', path);
    return storageApiClient.post(`/files/${bucket}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  download: (bucket: string, key: string) =>
    storageApiClient.get(`/files/${bucket}/${encodeURIComponent(key)}`, { responseType: 'blob' }),
  delete: (bucket: string, key: string) =>
    storageApiClient.delete(`/files/${bucket}/${encodeURIComponent(key)}`),
  getInfo: (bucket: string, key: string) =>
    storageApiClient.get<FileInfo>(`/files/${bucket}/info/${encodeURIComponent(key)}`),
};

export interface Bucket {
  name: string;
  creation_date?: string;
}

export interface FileInfo {
  key: string;
  size: number;
  last_modified: string;
  content_type?: string;
  is_directory?: boolean;
}

// AI API
export const aiApi = {
  chat: (question: string, options?: { model?: string; provider?: string; conversationId?: string; includesSources?: boolean; collection?: string; language?: string; systemPrompt?: string }) =>
    aiApiClient.post<ChatResponse>('/ai/chat', {
      question,
      model: options?.model,
      provider: options?.provider,
      conversation_id: options?.conversationId,
      include_sources: options?.includesSources ?? true,
      collection: options?.collection,
      language: options?.language,
      system_prompt: options?.systemPrompt,
    }),
  chatStream: (question: string, options?: { model?: string; provider?: string; conversationId?: string; collection?: string; language?: string; systemPrompt?: string }) =>
    aiApiClient.post('/ai/chat/stream', {
      question,
      model: options?.model,
      provider: options?.provider,
      conversation_id: options?.conversationId,
      collection: options?.collection,
      language: options?.language,
      system_prompt: options?.systemPrompt,
    }, {
      responseType: 'stream',
    }),
  search: (query: string, limit?: number, collection?: string) =>
    aiApiClient.get<SearchResult[]>('/ai/search', { params: { q: query, limit, collection } }),
  index: (documentId: string, content: string, filename: string, path: string, mimeType?: string, collection?: string) =>
    aiApiClient.post('/ai/index', { document_id: documentId, content, filename, path, mime_type: mimeType, collection }),
  removeDocument: (documentId: string) =>
    aiApiClient.delete(`/ai/index/${documentId}`),
  stats: () => aiApiClient.get<AIStats>('/ai/stats'),
  models: (provider?: string) =>
    aiApiClient.get<ModelsResponse>('/ai/models', {
      params: provider ? { provider } : undefined,
    }),
  providers: () => aiApiClient.get<ProvidersResponse>('/ai/providers'),
  // Knowledge Bases / Collections
  listCollections: () => aiApiClient.get<CollectionsResponse>('/ai/collections'),
  getCollection: (name: string) => aiApiClient.get<KnowledgeBase>(`/ai/collections/${name}`),
  createCollection: (data: CreateCollectionRequest) =>
    aiApiClient.post<KnowledgeBase>('/ai/collections', data),
  deleteCollection: (name: string) => aiApiClient.delete(`/ai/collections/${name}`),
  getCollectionStats: (name: string) => aiApiClient.get<CollectionStats>(`/ai/collections/${name}/stats`),
};

export interface ChatResponse {
  answer: string;
  sources?: { document_id: string; filename: string; score: number; excerpt: string }[];
  tokens_used?: number;
}

export interface ModelsResponse {
  models: Model[];
}

export interface SearchResult {
  id: string;
  document_id: string;
  content: string;
  filename: string;
  score: number;
}

export interface AIStats {
  documents_count: number;
  chunks_count: number;
  last_indexed?: string;
}

export interface Model {
  id: string;
  object?: string;
  owned_by?: string;
  name?: string;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
  active_provider: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  provider_type: 'ollama' | 'vllm' | 'openai' | 'anthropic';
  enabled: boolean;
  default_model: string;
  is_local: boolean;
}

// Knowledge Base / Collections types
export interface KnowledgeBase {
  name: string;
  description?: string;
  documents_count: number;
  chunks_count: number;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionsResponse {
  collections: KnowledgeBase[];
}

export interface CollectionStats {
  name: string;
  documents_count: number;
  chunks_count: number;
  size_bytes: number;
  avg_chunk_size: number;
  last_indexed?: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
}

// Routes/Proxy API
export const routesApi = {
  list: () => proxyApiClient.get<Route[]>('/routes'),
  get: (id: string) => proxyApiClient.get<Route>(`/routes/${id}`),
  create: (data: CreateRouteRequest) => proxyApiClient.post<Route>('/routes', data),
  update: (id: string, data: Partial<CreateRouteRequest>) =>
    proxyApiClient.put<Route>(`/routes/${id}`, data),
  delete: (id: string) => proxyApiClient.delete(`/routes/${id}`),
  // Certificates
  listCertificates: () => proxyApiClient.get<Certificate[]>('/certificates'),
  requestCertificate: (domain: string) =>
    proxyApiClient.post('/certificates/request', { domain }),
  renewCertificate: (id: string) =>
    proxyApiClient.post(`/certificates/${id}/renew`),
  deleteCertificate: (id: string) =>
    proxyApiClient.delete(`/certificates/${id}`),
  // Shield stats
  shieldStats: () => proxyApiClient.get<ShieldStats>('/shield/stats'),
};

export interface Route {
  id: string;
  name: string;
  host: string;
  target: string;
  mode: 'proxy' | 'redirect' | 'static' | 'loadbalancer';
  tls_enabled: boolean;
  tls_config?: TlsConfig;
  auth_required: boolean;
  enabled: boolean;
  shield_config?: ShieldConfig;
  headers?: HeadersConfig;
  dns_records?: DnsRecord[];
  created_at: string;
  updated_at: string;
}

export interface TlsConfig {
  wildcard: boolean;
  force_https: boolean;
  min_version?: 'TLS1.2' | 'TLS1.3';
  covered_domains?: string[];
}

export interface DnsRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS';
  name: string;
  value: string;
  ttl: number;
  priority?: number;
}

export interface ShieldConfig {
  enabled: boolean;
  requests_per_second: number;
  burst_size: number;
  block_duration_seconds: number;
  whitelist: string[];
  blacklist: string[];
  geo_block?: GeoBlockConfig;
}

export interface GeoBlockConfig {
  enabled: boolean;
  blocked_countries: string[];
}

export interface HeadersConfig {
  request_headers: HeaderEntry[];
  response_headers: HeaderEntry[];
  remove_request_headers: string[];
  remove_response_headers: string[];
}

export interface HeaderEntry {
  name: string;
  value: string;
}

export interface Certificate {
  id: string;
  domain: string;
  issuer: string;
  expires_at: string;
  auto_renew: boolean;
}

export interface ShieldStats {
  requests_total: number;
  requests_blocked: number;
  active_rules: number;
}

// Users API
export const usersApi = {
  list: (page?: number, limit?: number) =>
    identityApi.get<UserListResponse>('/users', { params: { page, limit } }),
  get: (id: string) => identityApi.get<User>(`/users/${id}`),
  create: (data: CreateUserRequest) => identityApi.post<User>('/users', data),
  update: (id: string, data: Partial<CreateUserRequest>) =>
    identityApi.put<User>(`/users/${id}`, data),
  delete: (id: string) => identityApi.delete(`/users/${id}`),
};

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

// Groups API
export const groupsApi = {
  list: () => identityApi.get<Group[]>('/groups'),
  get: (id: string) => identityApi.get<Group>(`/groups/${id}`),
  create: (data: CreateGroupRequest) => identityApi.post<Group>('/groups', data),
  update: (id: string, data: Partial<CreateGroupRequest>) =>
    identityApi.put<Group>(`/groups/${id}`, data),
  delete: (id: string) => identityApi.delete(`/groups/${id}`),
  // Members
  addMembers: (id: string, userIds: string[]) =>
    identityApi.post(`/groups/${id}/members`, { user_ids: userIds }),
  removeMember: (id: string, userId: string) =>
    identityApi.delete(`/groups/${id}/members/${userId}`),
  // Permissions
  getPermissions: (id: string) =>
    identityApi.get<GroupPermissions>(`/groups/${id}/permissions`),
  updatePermissions: (id: string, permissions: GroupPermissions) =>
    identityApi.put(`/groups/${id}/permissions`, permissions),
};

export interface Group {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  ldap_dn?: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface GroupPermissions {
  containers?: string[];  // ['read', 'write', 'delete']
  storage?: string[];
  routes?: string[];
  users?: string[];
  settings?: string[];
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  parent_id?: string;
}

// Metrics API
export const metricsApi = {
  all: () => metricsApiClient.get<SystemMetrics>('/metrics'),
  summary: () => metricsApiClient.get<SystemMetrics>('/metrics/summary'),
  health: () => metricsApiClient.get('/health'),
  cpu: () => metricsApiClient.get<CpuMetrics>('/metrics/cpu'),
  memory: () => metricsApiClient.get<MemoryMetrics>('/metrics/memory'),
  disk: () => metricsApiClient.get<DiskMetrics[]>('/metrics/disk'),
  network: () => metricsApiClient.get<NetworkMetrics>('/metrics/network'),
  // Alias for backward compatibility
  system: () => metricsApiClient.get<SystemMetrics>('/metrics/summary'),
  // History for charts
  history: (period: '5m' | '15m' | '1h' | '24h') =>
    metricsApiClient.get<MetricHistoryPoint[]>('/metrics/history', { params: { period } }),
};

// Alerts API
export const alertsApi = {
  // Alert configurations
  listConfigs: () => metricsApiClient.get<AlertConfig[]>('/alerts/configs'),
  getConfig: (id: string) => metricsApiClient.get<AlertConfig>(`/alerts/configs/${id}`),
  createConfig: (data: CreateAlertConfigRequest) =>
    metricsApiClient.post<AlertConfig>('/alerts/configs', data),
  updateConfig: (id: string, data: Partial<CreateAlertConfigRequest>) =>
    metricsApiClient.put<AlertConfig>(`/alerts/configs/${id}`, data),
  deleteConfig: (id: string) => metricsApiClient.delete(`/alerts/configs/${id}`),
  toggleConfig: (id: string, enabled: boolean) =>
    metricsApiClient.patch(`/alerts/configs/${id}`, { enabled }),
  // Active alerts
  listActive: () => metricsApiClient.get<AlertEvent[]>('/alerts/active'),
  // Alert history
  listHistory: (limit?: number, offset?: number) =>
    metricsApiClient.get<AlertHistoryResponse>('/alerts/history', { params: { limit, offset } }),
  // Acknowledge alert
  acknowledge: (id: string) => metricsApiClient.post(`/alerts/${id}/acknowledge`),
  // Test alert notification
  testNotification: (configId: string) =>
    metricsApiClient.post(`/alerts/configs/${configId}/test`),
};

// Metric History Point
export interface MetricHistoryPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  network_rx: number;
  network_tx: number;
}

// Alert Configuration
export interface AlertConfig {
  id: string;
  name: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  condition: 'above' | 'below';
  threshold: number;
  duration_seconds: number;
  enabled: boolean;
  actions: AlertAction[];
  created_at: string;
  updated_at: string;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'browser';
  config: {
    email?: string;
    webhook_url?: string;
  };
}

export interface CreateAlertConfigRequest {
  name: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  condition: 'above' | 'below';
  threshold: number;
  duration_seconds?: number;
  actions: AlertAction[];
}

// Alert Event
export interface AlertEvent {
  id: string;
  config_id: string;
  config_name: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  current_value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
  triggered_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
}

export interface AlertHistoryResponse {
  alerts: AlertEvent[];
  total: number;
}

export interface SystemMetrics {
  // API response fields
  hostname?: string;
  os_name?: string;
  uptime_seconds?: number;
  cpu_cores?: number;
  cpu_usage_percent?: number;
  memory_total_bytes?: number;
  memory_used_bytes?: number;
  memory_usage_percent?: number;
  disk_total_bytes?: number;
  disk_used_bytes?: number;
  disk_usage_percent?: number;
  network_rx_bytes?: number;
  network_tx_bytes?: number;
  // Legacy fields for compatibility
  cpu?: number;
  memory?: number;
  disk?: number;
  uptime?: number;
  load_average?: number[];
}

export interface CpuMetrics {
  usage_percent: number;
  cores: number;
  frequency_mhz?: number;
}

export interface MemoryMetrics {
  total: number;
  used: number;
  available: number;
  percent: number;
}

export interface DiskMetrics {
  name?: string;
  mount_point: string;
  file_system?: string;
  total: number;
  used: number;
  available: number;
  percent: number;
  // API returns these field names
  total_bytes?: number;
  used_bytes?: number;
  available_bytes?: number;
  usage_percent?: number;
  is_removable?: boolean;
}

export interface NetworkMetrics {
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
}

// Types for requests
export interface CreateContainerRequest {
  name: string;
  image: string;
  ports?: Record<string, string>;
  env?: Record<string, string>;
  volumes?: string[];
  restart_policy?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
}

export interface CreateRouteRequest {
  name: string;
  host: string;
  target: string;
  mode?: 'proxy' | 'redirect' | 'static' | 'loadbalancer';
  tls_enabled?: boolean;
  tls_config?: TlsConfig;
  auth_required?: boolean;
  shield_config?: ShieldConfig;
  headers?: HeadersConfig;
  dns_records?: DnsRecord[];
  enabled?: boolean;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  display_name?: string;
  role?: number;
}

// Audit Logs API
export const auditApi = {
  list: (filters?: AuditLogFilters) =>
    identityApi.get<AuditLogListResponse>('/audit-logs', { params: filters }),
  get: (id: string) => identityApi.get<AuditLog>(`/audit-logs/${id}`),
  getByUser: (userId: string, limit?: number, offset?: number) =>
    identityApi.get<AuditLogListResponse>(`/audit-logs/user/${userId}`, {
      params: { limit, offset },
    }),
  export: (filters?: AuditLogFilters) =>
    identityApi.get('/audit-logs/export', {
      params: filters,
      responseType: 'blob',
    }),
};

export interface AuditLog {
  id: string;
  user_id: string;
  username: string;
  action: AuditAction;
  resource_type: string;
  resource_id?: string;
  ip_address: string;
  user_agent?: string;
  details?: Record<string, unknown>;
  status: 'success' | 'failure';
  created_at: string;
}

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'password_changed'
  | 'password_reset'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'role_changed'
  | 'group_created'
  | 'group_updated'
  | 'group_deleted'
  | 'member_added'
  | 'member_removed'
  | 'permission_changed'
  | 'api_key_created'
  | 'api_key_revoked';

export interface AuditLogFilters {
  user_id?: string;
  username?: string;
  action?: AuditAction;
  resource_type?: string;
  status?: 'success' | 'failure';
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

// Users Import/Export
export interface UserImportRow {
  username: string;
  email: string;
  role: string;
  display_name?: string;
  mfa_enabled?: string;
}

export interface UserImportResult {
  success: number;
  failed: number;
  duplicates: number;
  errors: { row: number; username: string; error: string }[];
}

// Tunnel/SecureLink API (Web Tunnels - VPN sans client)
export const tunnelApi = {
  // Tunnels
  listTunnels: () => securelinkApiClient.get<TunnelsListResponse>('/tunnels'),
  getTunnel: (id: string) => securelinkApiClient.get<Tunnel>(`/tunnels/${id}`),
  createTunnel: (data: CreateTunnelRequest) =>
    securelinkApiClient.post<Tunnel>('/tunnels', data),
  updateTunnel: (id: string, data: Partial<CreateTunnelRequest>) =>
    securelinkApiClient.put<Tunnel>(`/tunnels/${id}`, data),
  deleteTunnel: (id: string) => securelinkApiClient.delete(`/tunnels/${id}`),
  reconnectTunnel: (id: string) => securelinkApiClient.post(`/tunnels/${id}/reconnect`),
  getTunnelStats: (id: string) => securelinkApiClient.get<TunnelStats>(`/tunnels/${id}/stats`),

  // Relays
  listRelays: () => securelinkApiClient.get<RelaysListResponse>('/relays'),
  getRelay: (id: string) => securelinkApiClient.get<Relay>(`/relays/${id}`),
  addRelay: (data: AddRelayRequest) =>
    securelinkApiClient.post<Relay>('/relays', data),
  updateRelay: (id: string, data: Partial<AddRelayRequest>) =>
    securelinkApiClient.put<Relay>(`/relays/${id}`, data),
  deleteRelay: (id: string) => securelinkApiClient.delete(`/relays/${id}`),
  testRelay: (id: string) => securelinkApiClient.post<RelayTestResult>(`/relays/${id}/test`),
  setPrimaryRelay: (id: string) => securelinkApiClient.post(`/relays/${id}/set-primary`),

  // DNS & Blocking
  getDnsConfig: () => securelinkApiClient.get<DnsConfig>('/dns/config'),
  updateDnsConfig: (data: Partial<DnsConfig>) =>
    securelinkApiClient.put<DnsConfig>('/dns/config', data),
  getDnsStats: () => securelinkApiClient.get<DnsStats>('/dns/stats'),
  addBlocklist: (data: AddBlocklistRequest) =>
    securelinkApiClient.post<Blocklist>('/dns/blocklists', data),
  removeBlocklist: (id: string) => securelinkApiClient.delete(`/dns/blocklists/${id}`),
  toggleBlocklist: (id: string, enabled: boolean) =>
    securelinkApiClient.patch(`/dns/blocklists/${id}`, { enabled }),
  addDnsRecord: (data: CustomDnsRecord) =>
    securelinkApiClient.post<CustomDnsRecord>('/dns/records', data),
  updateDnsRecord: (id: string, data: Partial<CustomDnsRecord>) =>
    securelinkApiClient.put<CustomDnsRecord>(`/dns/records/${id}`, data),
  deleteDnsRecord: (id: string) => securelinkApiClient.delete(`/dns/records/${id}`),

  // Dashboard stats
  getDashboardStats: () => securelinkApiClient.get<TunnelDashboardStats>('/dashboard/stats'),
  getTrafficHistory: (period: '1h' | '24h' | '7d' | '30d') =>
    securelinkApiClient.get<TrafficDataPoint[]>('/dashboard/traffic', { params: { period } }),
  quickConnect: (data?: { local_addr?: string }) =>
    securelinkApiClient.post<Tunnel>('/tunnels/quick', data || {}),
};

// Tunnel types
export interface Tunnel {
  id: string;
  name: string;
  local_addr: string;
  subdomain: string;
  public_url: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  relay_id: string;
  relay_name?: string;
  bytes_in: number;
  bytes_out: number;
  last_connected?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface TunnelsListResponse {
  tunnels: Tunnel[];
  total: number;
}

export interface CreateTunnelRequest {
  name: string;
  local_addr: string;
  subdomain: string;
  relay_id: string;
}

export interface TunnelStats {
  tunnel_id: string;
  bytes_in_total: number;
  bytes_out_total: number;
  requests_total: number;
  connections_active: number;
  uptime_seconds: number;
  last_activity?: string;
}

// Relay types
export interface Relay {
  id: string;
  name: string;
  url: string;
  is_primary: boolean;
  status: 'connected' | 'disconnected' | 'error';
  tunnels_count: number;
  latency_ms?: number;
  region?: string;
  created_at: string;
  updated_at: string;
}

export interface RelaysListResponse {
  relays: Relay[];
  total: number;
}

export interface AddRelayRequest {
  name: string;
  url: string;
  token?: string;
  is_primary?: boolean;
}

export interface RelayTestResult {
  success: boolean;
  latency_ms?: number;
  error?: string;
}

// DNS types
export interface DnsConfig {
  enabled: boolean;
  upstream: string[];
  adblock_enabled: boolean;
  blocklists: Blocklist[];
  custom_records: CustomDnsRecord[];
}

export interface DnsStats {
  total_queries: number;
  blocked_queries: number;
  blocked_percent: number;
  queries_today: number;
  blocked_today: number;
  top_blocked_domains?: { domain: string; count: number }[];
}

export interface Blocklist {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  entries_count: number;
  last_updated?: string;
}

export interface AddBlocklistRequest {
  name: string;
  url: string;
  enabled?: boolean;
}

export interface CustomDnsRecord {
  id?: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  ttl?: number;
}

// Dashboard types
export interface TunnelDashboardStats {
  tunnels_active: number;
  tunnels_total: number;
  relay_status: 'connected' | 'disconnected' | 'partial';
  relay_connected_count: number;
  relay_total_count: number;
  dns_queries_today: number;
  ads_blocked_today: number;
  bytes_in_today: number;
  bytes_out_today: number;
}

export interface TrafficDataPoint {
  timestamp: string;
  bytes_in: number;
  bytes_out: number;
}

// Scheduler API
export const schedulerApi = {
  // Jobs
  listJobs: () => schedulerApiClient.get<ScheduledJob[]>('/jobs'),
  getJob: (id: string) => schedulerApiClient.get<ScheduledJob>(`/jobs/${id}`),
  createJob: (data: CreateJobRequest) =>
    schedulerApiClient.post<ScheduledJob>('/jobs', data),
  updateJob: (id: string, data: Partial<CreateJobRequest>) =>
    schedulerApiClient.put<ScheduledJob>(`/jobs/${id}`, data),
  deleteJob: (id: string) => schedulerApiClient.delete(`/jobs/${id}`),
  enableJob: (id: string) => schedulerApiClient.post(`/jobs/${id}/enable`),
  disableJob: (id: string) => schedulerApiClient.post(`/jobs/${id}/disable`),
  runJob: (id: string) => schedulerApiClient.post(`/jobs/${id}/run`),
  // Job runs
  listRuns: (jobId: string) =>
    schedulerApiClient.get<JobRun[]>(`/jobs/${jobId}/runs`),
  getRunOutput: (jobId: string, runId: string) =>
    schedulerApiClient.get<JobRun>(`/jobs/${jobId}/runs/${runId}`),
};

export interface ScheduledJob {
  id: string;
  name: string;
  cron_expression: string;
  command: string;
  description?: string;
  target_type: 'container' | 'host';
  target_id?: string;
  enabled: boolean;
  last_run?: string;
  last_status?: 'success' | 'failed' | 'running';
  created_at: string;
}

export interface JobRun {
  id: string;
  job_id: string;
  started_at: string;
  finished_at?: string;
  status: 'running' | 'success' | 'failed';
  output?: string;
  error?: string;
}

export interface CreateJobRequest {
  name: string;
  cron_expression: string;
  command: string;
  description?: string;
  target_type: 'container' | 'host';
  target_id?: string;
  enabled?: boolean;
}

// === NAS Features API ===

// Shares API
export const sharesApi = {
  list: (bucket?: string, activeOnly?: boolean) =>
    storageApiClient.get<ShareListResponse>('/shares', { params: { bucket, active_only: activeOnly } }),
  create: (data: CreateShareRequest) =>
    storageApiClient.post<CreateShareResponse>('/shares', data),
  get: (id: string) => storageApiClient.get<ShareLink>(`/shares/${id}`),
  update: (id: string, data: UpdateShareRequest) =>
    storageApiClient.put<ShareLink>(`/shares/${id}`, data),
  delete: (id: string) => storageApiClient.delete(`/shares/${id}`),
  // Public access (no auth)
  access: (token: string, password?: string) =>
    axios.post<ShareAccessResponse>(`${STORAGE_URL}/shares/${token}/access`, { password }),
  download: (token: string) =>
    `${STORAGE_URL}/shares/${token}/download`,
};

export interface ShareLink {
  id: string;
  bucket: string;
  key: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at?: string;
  password_protected: boolean;
  max_downloads?: number;
  download_count: number;
  access_type: 'view' | 'download' | 'edit';
  is_active: boolean;
}

export interface ShareListResponse {
  shares: ShareLink[];
  total: number;
}

export interface CreateShareRequest {
  bucket: string;
  key: string;
  expires_in_hours?: number;
  password?: string;
  max_downloads?: number;
  access_type?: 'view' | 'download' | 'edit';
}

export interface CreateShareResponse {
  id: string;
  token: string;
  url: string;
  expires_at?: string;
}

export interface UpdateShareRequest {
  expires_in_hours?: number;
  password?: string;
  max_downloads?: number;
  access_type?: 'view' | 'download' | 'edit';
  is_active?: boolean;
}

export interface ShareAccessResponse {
  bucket: string;
  key: string;
  filename: string;
  size: number;
  content_type: string;
  access_type: 'view' | 'download' | 'edit';
  download_url?: string;
}

// Trash API
export const trashApi = {
  list: (bucket?: string, search?: string, limit?: number, offset?: number) =>
    storageApiClient.get<TrashListResponse>('/trash', {
      params: { bucket, search, limit, offset }
    }),
  get: (id: string) => storageApiClient.get<TrashItem>(`/trash/${id}`),
  moveToTrash: (bucket: string, keys: string[]) =>
    storageApiClient.post<MoveToTrashResponse>('/trash', { bucket, keys }),
  restore: (items: string[], destination?: { bucket: string; prefix?: string }) =>
    storageApiClient.post<RestoreResponse>('/trash/restore', { items, destination }),
  delete: (id: string) => storageApiClient.delete(`/trash/${id}`),
  empty: (items?: string[]) =>
    storageApiClient.delete('/trash', { data: items }),
  stats: () => storageApiClient.get<TrashStats>('/trash/stats'),
};

export interface TrashItem {
  id: string;
  original_bucket: string;
  original_key: string;
  trash_key: string;
  filename: string;
  size: number;
  content_type: string;
  deleted_by: string;
  deleted_at: string;
  expires_at: string;
}

export interface TrashListResponse {
  items: TrashItem[];
  total: number;
  total_size: number;
}

export interface MoveToTrashResponse {
  moved: TrashItem[];
  failed: { key: string; error: string }[];
}

export interface RestoreResponse {
  restored: { id: string; bucket: string; key: string }[];
  failed: { id: string; error: string }[];
}

export interface TrashStats {
  total_items: number;
  total_size: number;
  oldest_item?: string;
  items_expiring_soon: number;
}

// Favorites API
export const favoritesApi = {
  list: (bucket?: string, foldersOnly?: boolean) =>
    storageApiClient.get<FavoritesListResponse>('/favorites', {
      params: { bucket, folders_only: foldersOnly }
    }),
  add: (data: AddFavoriteRequest) =>
    storageApiClient.post<Favorite>('/favorites', data),
  get: (id: string) => storageApiClient.get<FavoriteWithInfo>(`/favorites/${id}`),
  update: (id: string, data: UpdateFavoriteRequest) =>
    storageApiClient.put<Favorite>(`/favorites/${id}`, data),
  remove: (id: string) => storageApiClient.delete(`/favorites/${id}`),
  removeByPath: (bucket: string, key: string) =>
    storageApiClient.delete(`/favorites/path/${bucket}/${encodeURIComponent(key)}`),
  check: (bucket: string, key: string) =>
    storageApiClient.get<boolean>(`/favorites/check/${bucket}/${encodeURIComponent(key)}`),
  reorder: (order: string[]) =>
    storageApiClient.post('/favorites/reorder', { order }),
};

export interface Favorite {
  id: string;
  user_id: string;
  bucket: string;
  key: string;
  is_folder: boolean;
  display_name?: string;
  color?: string;
  added_at: string;
  sort_order: number;
}

export interface FavoriteWithInfo extends Favorite {
  filename: string;
  size?: number;
  content_type?: string;
  exists: boolean;
}

export interface FavoritesListResponse {
  favorites: FavoriteWithInfo[];
  total: number;
}

export interface AddFavoriteRequest {
  bucket: string;
  key: string;
  is_folder: boolean;
  display_name?: string;
  color?: string;
}

export interface UpdateFavoriteRequest {
  display_name?: string;
  color?: string;
  sort_order?: number;
}

// Search API
export const searchApi = {
  search: (query: string, options?: SearchOptions) =>
    storageApiClient.get<SearchResponse>('/search', {
      params: { q: query, ...options }
    }),
  quickSearch: (query: string, limit?: number) =>
    storageApiClient.get<QuickSearchResponse>('/search/quick', {
      params: { q: query, limit }
    }),
  recent: (limit?: number) =>
    storageApiClient.get<QuickSearchResult[]>('/search/recent', { params: { limit } }),
  suggest: (query: string) =>
    storageApiClient.get<string[]>('/search/suggest', { params: { q: query } }),
};

export interface SearchOptions {
  bucket?: string;
  prefix?: string;
  file_type?: string;
  content_type?: string;
  min_size?: number;
  max_size?: number;
  modified_after?: string;
  modified_before?: string;
  include_content?: boolean;
  sort_by?: 'name' | 'size' | 'modified' | 'relevance';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  query: string;
  facets: SearchFacets;
  took_ms: number;
}

export interface SearchResultItem {
  bucket: string;
  key: string;
  filename: string;
  path: string;
  size: number;
  content_type: string;
  modified_at: string;
  score: number;
  highlights: { field: string; snippet: string }[];
  preview?: {
    thumbnail_url?: string;
    preview_text?: string;
  };
}

export interface SearchFacets {
  buckets: { value: string; count: number }[];
  file_types: { value: string; count: number }[];
  size_ranges: { label: string; min?: number; max?: number; count: number }[];
}

export interface QuickSearchResponse {
  results: QuickSearchResult[];
  total: number;
}

export interface QuickSearchResult {
  bucket: string;
  key: string;
  filename: string;
  content_type: string;
  size: number;
}

// Quotas API
export const quotasApi = {
  getMyQuota: () => storageApiClient.get<QuotaUsage>('/quotas/me'),
  getAlerts: () => storageApiClient.get<QuotaAlert[]>('/quotas/me/alerts'),
  getUserQuota: (userId: string) =>
    storageApiClient.get<QuotaUsage>(`/quotas/users/${userId}`),
  setUserQuota: (userId: string, quota: SetQuotaRequest) =>
    storageApiClient.put<StorageQuota>(`/quotas/users/${userId}`, quota),
  deleteUserQuota: (userId: string) =>
    storageApiClient.delete(`/quotas/users/${userId}`),
  recalculate: (userId: string) =>
    storageApiClient.post<QuotaUsage>(`/quotas/users/${userId}/recalculate`),
  getUsersOverLimit: () =>
    storageApiClient.get<QuotaUsage[]>('/quotas/over-limit'),
};

export interface StorageQuota {
  user_id: string;
  max_storage_bytes?: number;
  max_files?: number;
  max_file_size?: number;
  used_storage_bytes: number;
  file_count: number;
  allowed_buckets: string[];
  created_at: string;
  updated_at: string;
}

export interface QuotaUsage {
  user_id: string;
  storage: UsageInfo;
  files: UsageInfo;
  buckets: BucketUsage[];
}

export interface UsageInfo {
  used: number;
  limit?: number;
  percentage?: number;
}

export interface BucketUsage {
  bucket: string;
  used_bytes: number;
  file_count: number;
}

export interface SetQuotaRequest {
  max_storage_bytes?: number;
  max_files?: number;
  max_file_size?: number;
  allowed_buckets?: string[];
}

export interface QuotaAlert {
  alert_type: 'warning' | 'critical' | 'exceeded';
  resource: string;
  current: number;
  limit: number;
  percentage: number;
  message: string;
}

// Preview API
export const previewApi = {
  getInfo: (bucket: string, key: string) =>
    storageApiClient.get<PreviewInfo>(`/preview/info/${bucket}/${encodeURIComponent(key)}`),
  getThumbnailUrl: (bucket: string, key: string, size?: 'small' | 'medium' | 'large') =>
    `${STORAGE_URL}/preview/thumbnail/${bucket}/${encodeURIComponent(key)}?size=${size || 'medium'}`,
  getPreviewUrl: (bucket: string, key: string) =>
    `${STORAGE_URL}/preview/view/${bucket}/${encodeURIComponent(key)}`,
};

export interface PreviewInfo {
  previewable: boolean;
  preview_type: 'image' | 'pdf' | 'document' | 'video' | 'audio' | 'text' | 'code' | 'none';
  pages?: number;
  thumbnail_url?: string;
  preview_url?: string;
}

// === Media Processing API ===

// OCR API
export const ocrApi = {
  extractText: (file: File, options?: OcrOptions) => {
    const formData = new FormData();
    formData.append('file', file);
    return mediaApiClient.post<OcrResponse>('/ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: options,
    });
  },
  processDocument: (file: File, options?: OcrOptions) => {
    const formData = new FormData();
    formData.append('file', file);
    return mediaApiClient.post<OcrResponse>('/ocr/document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: options,
    });
  },
  batchProcess: (files: string[], options?: OcrOptions) =>
    mediaApiClient.post<BatchOcrResponse>('/ocr/batch', { files, ...options }),
};

export interface OcrOptions {
  languages?: string;
  detect_layout?: boolean;
  detect_tables?: boolean;
}

export interface OcrResponse {
  success: boolean;
  text: string;
  confidence: number;
  pages: OcrPage[];
  metadata: OcrMetadata;
}

export interface OcrPage {
  page_number: number;
  text: string;
  blocks_count: number;
  tables_count: number;
}

export interface OcrMetadata {
  provider: string;
  processing_time_ms: number;
  total_pages: number;
  detected_languages: string[];
}

export interface BatchOcrResponse {
  job_id: string;
  status: string;
  total_files: number;
}

// TTS API (Text-to-Speech)
export const ttsApi = {
  synthesize: (text: string, options?: TtsOptions) =>
    mediaApiClient.post('/tts/synthesize', { text, ...options }, {
      responseType: 'blob',
    }),
  synthesizeStream: (text: string, options?: TtsOptions) =>
    `${MEDIA_URL}/tts/stream`,
  listVoices: () => mediaApiClient.get<Voice[]>('/tts/voices'),
};

export interface TtsOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  format?: 'wav' | 'mp3' | 'ogg' | 'flac';
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  description?: string;
}

// STT API (Speech-to-Text)
export const sttApi = {
  transcribe: (file: File, options?: SttOptions) => {
    const formData = new FormData();
    formData.append('file', file);
    return mediaApiClient.post<TranscribeResponse>('/stt/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: options,
    });
  },
  transcribeStream: (file: File, options?: SttOptions) => {
    const formData = new FormData();
    formData.append('file', file);
    // Returns EventSource URL
    return mediaApiClient.post('/stt/stream', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: options,
    });
  },
  listModels: () => mediaApiClient.get<SttModel[]>('/stt/models'),
};

export interface SttOptions {
  language?: string;
  model?: string;
  task?: 'transcribe' | 'translate';
  word_timestamps?: boolean;
  diarize?: boolean;
}

export interface TranscribeResponse {
  success: boolean;
  text: string;
  language: string;
  language_probability: number;
  duration_seconds: number;
  segments: TranscribeSegment[];
  words?: TranscribeWord[];
  speakers?: Speaker[];
  model_used: string;
  processing_time_ms: number;
}

export interface TranscribeSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface TranscribeWord {
  word: string;
  start: number;
  end: number;
  probability: number;
  speaker?: string;
}

export interface Speaker {
  id: string;
  label: string;
  speaking_time: number;
}

export interface SttModel {
  id: string;
  name: string;
  language?: string;
  size?: string;
}

// Media Jobs API
export const mediaJobsApi = {
  getStatus: (jobId: string) =>
    mediaApiClient.get<MediaJobStatus>(`/jobs/${jobId}`),
};

export interface MediaJobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total_items: number;
  completed_items: number;
  failed_items: number;
  created_at: string;
  updated_at: string;
  result?: Record<string, unknown>;
  error?: string;
}

// === Storage Management API (RAID, Disks, Mounts, External) ===

// RAID API
export const raidApi = {
  // Arrays
  listArrays: () => storageApiClient.get<RaidArray[]>('/raid/arrays'),
  getArray: (id: string) => storageApiClient.get<RaidArray>(`/raid/arrays/${id}`),
  getArrayByName: (name: string) => storageApiClient.get<RaidArray>(`/raid/arrays/name/${name}`),
  createArray: (data: CreateRaidArrayRequest) =>
    storageApiClient.post<RaidArray>('/raid/arrays', data),
  deleteArray: (id: string) => storageApiClient.delete(`/raid/arrays/${id}`),
  rebuildArray: (id: string) => storageApiClient.post(`/raid/arrays/${id}/rebuild`),
  addDiskToArray: (arrayId: string, diskId: string) =>
    storageApiClient.post(`/raid/arrays/${arrayId}/disks`, { disk_id: diskId }),
  removeDiskFromArray: (arrayId: string, diskId: string) =>
    storageApiClient.delete(`/raid/arrays/${arrayId}/disks/${diskId}`),
  getArrayEvents: (arrayId: string, limit?: number) =>
    storageApiClient.get<RaidEvent[]>(`/raid/arrays/${arrayId}/events`, { params: { limit } }),

  // Disks
  listDisks: () => storageApiClient.get<DiskInfo[]>('/raid/disks'),
  getDisk: (id: string) => storageApiClient.get<DiskInfo>(`/raid/disks/${id}`),
  scanDisks: () => storageApiClient.post<DiskInfo[]>('/raid/disks/scan'),

  // Events & Health
  listEvents: (limit?: number, severity?: string) =>
    storageApiClient.get<RaidEvent[]>('/raid/events', { params: { limit, severity } }),
  getHealth: () => storageApiClient.get<RaidHealth>('/raid/health'),
};

export interface RaidArray {
  id: string;
  name: string;
  device_path: string;
  raid_level: 'raid0' | 'raid1' | 'raid5' | 'raid6' | 'raid10' | 'raidz' | 'raidz2';
  status: 'active' | 'degraded' | 'rebuilding' | 'failed' | 'inactive';
  total_size_bytes: number;
  used_size_bytes: number;
  rebuild_progress?: number;
  disks: DiskInfo[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DiskInfo {
  id: string;
  device_path: string;
  serial_number?: string;
  model?: string;
  size_bytes: number;
  status: 'healthy' | 'warning' | 'failing' | 'failed' | 'spare';
  smart_data?: SmartData;
  array_id?: string;
  slot_number?: number;
  temperature?: number;
  last_check?: string;
  created_at: string;
  updated_at: string;
}

export interface SmartData {
  power_on_hours: number;
  reallocated_sectors: number;
  pending_sectors: number;
  temperature: number;
  health_assessment: string;
  raw_data?: Record<string, unknown>;
}

export interface RaidEvent {
  id: string;
  array_id?: string;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RaidHealth {
  status: 'healthy' | 'warning' | 'critical';
  arrays_total: number;
  arrays_healthy: number;
  arrays_degraded: number;
  arrays_failed: number;
  disks_total: number;
  disks_healthy: number;
  disks_warning: number;
  disks_failing: number;
  last_check?: string;
}

export interface CreateRaidArrayRequest {
  name: string;
  raid_level: string;
  disk_ids: string[];
  spare_ids?: string[];
}

// Storage Stats API
export const storageStatsApi = {
  getStats: () => storageApiClient.get<StorageStats>('/stats'),
};

export interface StorageStats {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  buckets_count: number;
  files_count: number;
  arrays_count: number;
  health_status: 'healthy' | 'warning' | 'critical';
}

// Mounts API (requires backend implementation)
export const mountsApi = {
  list: () => storageApiClient.get<MountPoint[]>('/mounts'),
  mount: (data: MountRequest) => storageApiClient.post('/mounts', data),
  unmount: (mountPoint: string) =>
    storageApiClient.delete(`/mounts/${encodeURIComponent(mountPoint)}`),
  getInfo: (mountPoint: string) =>
    storageApiClient.get<MountPoint>(`/mounts/${encodeURIComponent(mountPoint)}`),
};

export interface MountPoint {
  device: string;
  mount_point: string;
  file_system: string;
  options: string[];
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  usage_percent: number;
  is_removable?: boolean;
  is_network?: boolean;
}

export interface MountRequest {
  device: string;
  mount_point: string;
  file_system?: string;
  options?: string[];
}

// External Storage API (USB, NAS, Cloud)
export const externalStorageApi = {
  list: () => storageApiClient.get<ExternalStorage[]>('/external'),
  detect: () => storageApiClient.post<ExternalStorage[]>('/external/detect'),
  connect: (data: ConnectExternalRequest) =>
    storageApiClient.post<ExternalStorage>('/external', data),
  disconnect: (id: string) => storageApiClient.delete(`/external/${id}`),
  getStatus: (id: string) => storageApiClient.get<ExternalStorage>(`/external/${id}`),
  eject: (id: string) => storageApiClient.post(`/external/${id}/eject`),
};

export interface ExternalStorage {
  id: string;
  name: string;
  type: 'usb' | 'nas' | 'smb' | 'nfs' | 's3' | 'cloud';
  connection_string?: string;
  mount_point?: string;
  size_bytes?: number;
  used_bytes?: number;
  status: 'connected' | 'disconnected' | 'mounting' | 'error';
  error_message?: string;
  last_seen?: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectExternalRequest {
  name: string;
  type: 'smb' | 'nfs' | 's3';
  connection_string: string;
  mount_point?: string;
  username?: string;
  password?: string;
  options?: Record<string, string>;
}
