/**
 * Containers API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, getServiceBaseUrl, ServiceName } from './factory';

// Get the containers service client (cached)
const containersClient = getClient(ServiceName.CONTAINERS);
const CONTAINERS_URL = getServiceBaseUrl(ServiceName.CONTAINERS);

// App Store API
export const storeApi = {
    listApps: (category?: string, search?: string) =>
        containersClient.get<StoreApp[]>('/store/apps', { params: { category, search } }),
    getApp: (id: string) => containersClient.get<StoreApp>(`/store/apps/${id}`),
    installApp: (id: string, config?: Record<string, unknown>) =>
        containersClient.post(`/store/apps/${id}/install`, { config }),
    getCategories: () => containersClient.get<string[]>('/store/categories'),
    getAppDetails: (sourceId: string | undefined, appId: string) =>
        containersClient.get<AppDetails>(`/store/sources/${sourceId}/apps/${appId}/details`),
    install: (data: InstallRequest) =>
        containersClient.post<InstallResponse>('/store/install', data),
    installMulti: (data: InstallMultiRequest) =>
        containersClient.post<{ install_id: string }>('/store/install-multi', data),
    checkPorts: (ports: number[]) =>
        containersClient.post<PortConflict[]>('/store/check-ports', { ports }),
    refreshAll: () => containersClient.post('/store/refresh'),
    listSources: () => containersClient.get<AppSource[]>('/store/sources'),
    addSource: (data: { name: string; url: string }) =>
        containersClient.post<AppSource>('/store/sources', data),
    validateSource: (data: { name: string; url: string }) =>
        containersClient.post<{ valid: boolean; app_count?: number; error?: string }>('/store/sources/validate', data),
    deleteSource: (id: string) => containersClient.delete(`/store/sources/${id}`),
    refreshSource: (id: string) => containersClient.post(`/store/sources/${id}/refresh`),
};

export interface StoreApp {
    id: string;
    name: string;
    description: string;
    long_description?: string;
    version: string;
    icon_url: string;
    icon?: string;
    image?: string;
    category: string;
    tags: string[];
    screenshots?: string[];
    maintainer: string;
    repository_url?: string;
    repository?: string;
    default_config: Record<string, unknown>;
    readme?: string;
    installed?: boolean;
    source_id: string;
    source_name: string;
    duplicate_count?: number;
    other_sources?: { source_id: string; source_name: string }[];
    supported_architectures: string[];
}

export interface AppDetails {
    app: StoreApp;
    config: { services: ParsedService[] };
}

export interface ParsedService {
    service_name: string;
    image: string;
    container_name?: string;
    ports: { host: number; container: number; protocol: string }[];
    environment: { key: string; default?: string }[];
    volumes: { source: string; target: string }[];
    labels?: Record<string, string>;
}

export interface PortConflict {
    port: number;
    in_use: boolean;
    used_by?: string;
}

export interface AppSource {
    id: string;
    name: string;
    url: string;
    app_count: number;
    last_fetched?: string;
    last_error?: string;
}

export interface InstallRequest {
    app_id: string;
    source_id?: string;
    container_name: string;
    environment?: Record<string, string>;
    ports?: { host: number; container: number; protocol: string }[];
    volumes?: { source: string; target: string }[];
    labels?: Record<string, string>;
    auto_start?: boolean;
}

export interface InstallResponse {
    id: string;
    name: string;
    docker_info?: {
        ports?: { host_port: number; container_port: number; protocol?: string }[];
        state?: string;
    };
}

export interface InstallMultiRequest {
    app_id: string;
    source_id?: string;
    group_name: string;
    services: {
        service_name: string;
        container_name: string;
        environment?: Record<string, string>;
        ports?: { host: number; container: number; protocol: string }[];
        volumes?: { source: string; target: string }[];
        labels?: Record<string, string>;
    }[];
    auto_start?: boolean;
}

// Docker Compose API
export const composeApi = {
    listProjects: () => containersClient.get<ComposeProject[]>('/compose/projects'),
    getProject: (name: string) => containersClient.get<ComposeProject>(`/compose/projects/${name}`),
    createProject: (name: string, content: string) =>
        containersClient.post<ComposeProject>('/compose/projects', { name, content }),
    updateProject: (name: string, content: string) =>
        containersClient.put<ComposeProject>(`/compose/projects/${name}`, { content }),
    deleteProject: (name: string, removeVolumes: boolean = false) =>
        containersClient.delete(`/compose/projects/${name}`, { params: { remove_volumes: removeVolumes } }),
    startProject: (name: string) => containersClient.post(`/compose/projects/${name}/start`),
    stopProject: (name: string) => containersClient.post(`/compose/projects/${name}/stop`),
    restartProject: (name: string) => containersClient.post(`/compose/projects/${name}/restart`),
    pullProject: (name: string) => containersClient.post(`/compose/projects/${name}/pull`),
    logs: (name: string, service?: string, lines: number = 100) =>
        containersClient.get<string>(`/compose/projects/${name}/logs`, { params: { service, lines } }),
    validate: (content: string) => containersClient.post('/compose/validate', { content }),
    preview: (content: string) =>
        containersClient.post<ComposePreviewResponse>('/compose/preview', { content }),
    import: (content: string, autoStart: boolean = true) =>
        containersClient.post<ComposeProject[]>('/compose/import', { content, auto_start: autoStart }),
};

export interface ComposeProject {
    name: string;
    status: 'running' | 'stopped' | 'partially_running' | 'error';
    services: ComposeService[];
    file_path: string;
    created_at: string;
    updated_at: string;
}

export interface ComposeService {
    name: string;
    image: string;
    state: string; // 'running', 'exited', etc.
    status: string; // 'Up 2 hours', etc.
    ports: string[];
}

export interface ComposeServicePreview {
    service_name: string;
    image: string;
    ports: { host: number; container: number }[];
    volumes: string[];
    environment: string[];
}

export interface ComposePreviewResponse {
    services: ComposeServicePreview[];
}

// Containers API
export const containersApi = {
    list: (all: boolean = false) =>
        containersClient.get<ContainerInfo[]>('/containers', { params: { all } }),
    get: (id: string) => containersClient.get<ContainerInfo>(`/containers/${id}`),
    create: (data: CreateContainerRequest) => containersClient.post<ContainerInfo>('/containers', data),
    start: (id: string) => containersClient.post(`/containers/${id}/start`),
    stop: (id: string) => containersClient.post(`/containers/${id}/stop`),
    restart: (id: string) => containersClient.post(`/containers/${id}/restart`),
    delete: (id: string, force: boolean = false) =>
        containersClient.delete(`/containers/${id}`, { params: { force } }),
    logs: (id: string, tail: number = 100) =>
        containersClient.get<string>(`/containers/${id}/logs`, { params: { tail } }),
    stats: (id: string) => containersClient.get<ContainerStats>(`/containers/${id}/stats`),
    exec: (id: string, cmd: string[]) =>
        containersClient.post(`/containers/${id}/exec`, { cmd }),
    prune: () => containersClient.post('/containers/prune'),
    // Update container to latest image
    update: (id: string) => containersClient.post(`/containers/${id}/update`),
    // Remove container (alias for delete)
    remove: (id: string, force: boolean = false) =>
        containersClient.delete(`/containers/${id}`, { params: { force } }),
    // Docker-specific operations
    startDocker: (dockerId: string) =>
        containersClient.post(`/containers/docker/${dockerId}/start`),
    stopDocker: (dockerId: string) =>
        containersClient.post(`/containers/docker/${dockerId}/stop`),
    restartDocker: (dockerId: string) =>
        containersClient.post(`/containers/docker/${dockerId}/restart`),
    removeDocker: (dockerId: string, force: boolean = false) =>
        containersClient.delete(`/containers/docker/${dockerId}`, { params: { force } }),
    inspectDocker: (dockerId: string) =>
        containersClient.get<ContainerInfo>(`/containers/docker/${dockerId}/inspect`),
};

export interface CreateContainerRequest {
    name: string;
    image: string;
    ports?: Record<string, string>;
    env?: Record<string, string>;
    volumes?: string[];
    restart_policy?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
}

export interface PortInfo {
    container_port: number;
    host_port?: number;
    host_ip?: string;
    protocol: string;
}

export interface MountInfo {
    source?: string;
    destination: string;
    mount_type: string;
    rw: boolean;
}

export interface ResourceInfo {
    memory_limit?: number;
    nano_cpus?: number;
    cpu_shares?: number;
}

export interface HealthInfo {
    status: string;
    failing_streak: number;
    test?: string[];
}

export interface ContainerInfo {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    created: string;
    ports: PortInfo[];
    labels: Record<string, string>;
    networks: string[];
    env?: string[];
    mounts?: MountInfo[];
    cmd?: string[];
    entrypoint?: string[];
    working_dir?: string;
    hostname?: string;
    user?: string;
    restart_policy?: string;
    restart_count?: number;
    resources?: ResourceInfo;
    health?: HealthInfo;
}

export interface ContainerStats {
    cpu_percent: number;
    memory_usage: number;
    memory_limit: number;
    memory_percent: number;
    net_rx: number;
    net_tx: number;
    block_read: number;
    block_write: number;
    pids: number;
}

// Backups API
export const backupsApi = {
    listProfiles: () => containersClient.get<BackupProfile[]>('/backups/profiles'),
    getProfile: (id: string) => containersClient.get<BackupProfile>(`/backups/profiles/${id}`),
    createProfile: (data: CreateBackupProfileRequest) =>
        containersClient.post<BackupProfile>('/backups/profiles', data),
    updateProfile: (id: string, data: Partial<CreateBackupProfileRequest>) =>
        containersClient.put<BackupProfile>(`/backups/profiles/${id}`, data),
    deleteProfile: (id: string) => containersClient.delete(`/backups/profiles/${id}`),

    listBackups: (profileId?: string) =>
        containersClient.get<BackupItem[]>('/backups/list', { params: { profile_id: profileId } }),
    createBackup: (profileId: string) =>
        containersClient.post<BackupItem>(`/backups/profiles/${profileId}/run`),
    restoreBackup: (backupId: string) =>
        containersClient.post(`/backups/${backupId}/restore`),
    deleteBackup: (backupId: string) => containersClient.delete(`/backups/${backupId}`),
    downloadBackup: (backupId: string) =>
        containersClient.get(`/backups/${backupId}/download`, { responseType: 'blob' }),

    // Aliases used by the UI
    list: () => containersClient.get<{ profiles: BackupProfile[] }>('/backups/profiles'),
    create: (data: CreateBackupProfileRequest) =>
        containersClient.post<BackupProfile>('/backups/profiles', data),
    update: (id: string, data: Partial<BackupProfile>) =>
        containersClient.put<BackupProfile>(`/backups/profiles/${id}`, data),
    remove: (id: string) => containersClient.delete(`/backups/profiles/${id}`),
    run: (profileId: string) =>
        containersClient.post(`/backups/profiles/${profileId}/run`),
    snapshots: (profileId: string) =>
        containersClient.get<{ snapshots: ContainerBackupSnapshot[] }>(`/backups/profiles/${profileId}/snapshots`),
    restore: (profileId: string, snapshotId: string, targetPath?: string) =>
        containersClient.post(`/backups/profiles/${profileId}/restore`, { snapshot_id: snapshotId, target_path: targetPath }),
    runs: (profileId: string) =>
        containersClient.get<{ runs: BackupRun[] }>(`/backups/profiles/${profileId}/runs`),
};

export interface BackupProfile {
    id: string;
    name: string;
    schedule?: string;
    targets: BackupTarget[];
    retention_days: number;
    enabled: boolean;
    last_run?: string;
    next_run?: string;
    destination_type: string;
    container_ids: string[];
    destination_config: Record<string, unknown>;
    retention_policy?: { keep_last?: number; keep_daily?: number; keep_weekly?: number };
    last_run_at?: string;
    // Extended monitoring fields
    last_status?: 'success' | 'failed' | 'running';
    last_size_bytes?: number;
    last_duration_ms?: number;
}

export interface BackupTarget {
    type: 'volume' | 'directory' | 'database';
    source: string;
    options?: Record<string, string>;
}

export interface CreateBackupProfileRequest {
    name: string;
    schedule?: string;
    targets?: BackupTarget[];
    retention_days?: number;
    enabled?: boolean;
    container_ids?: string[];
    destination_type?: string;
    destination_config?: Record<string, unknown>;
    retention_policy?: { keep_last?: number; keep_daily?: number; keep_weekly?: number };
    password?: string;
}

export interface BackupItem {
    id: string;
    profile_id: string;
    profile_name: string;
    filename: string;
    size_bytes: number;
    created_at: string;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
}

export interface ContainerBackupSnapshot {
    id: string;
    short_id: string;
    time: string;
    tags?: string[];
}

export interface BackupRun {
    id: string;
    status: string;
    snapshot_id?: string;
    files_new?: number;
    files_changed?: number;
    size_bytes?: number;
    duration_seconds?: number;
    started_at: string;
    error?: string;
}

// Install Progress API (SSE)
export const getInstallProgressUrl = (id: string) => `${CONTAINERS_URL}/store/install/${id}/progress`;

export interface InstallEvent {
    type: 'PullingImage' | 'CreatingContainer' | 'Starting' | 'ServiceReady' | 'Error' | 'Complete';
    service_name?: string;
    message?: string;
    progress?: number;
}

// Networks API
export const networksApi = {
    list: () => containersClient.get('/networks'),
    get: (id: string) => containersClient.get(`/networks/${id}`),
    create: (data: any) => containersClient.post('/networks', data),
    delete: (id: string) => containersClient.delete(`/networks/${id}`),
    connect: (id: string, containerId: string) => containersClient.post(`/networks/${id}/connect`, { container: containerId }),
    disconnect: (id: string, containerId: string) => containersClient.post(`/networks/${id}/disconnect`, { container: containerId }),
};

// Volumes API
export const volumesApi = {
    list: () => containersClient.get('/volumes'),
    get: (id: string) => containersClient.get(`/volumes/${id}`),
    create: (data: any) => containersClient.post('/volumes', data),
    delete: (id: string) => containersClient.delete(`/volumes/${id}`),
    prune: () => containersClient.post('/volumes/prune'),
};
