import { containersApiClient, CONTAINERS_URL } from './core';

// App Store API
export const storeApi = {
    listApps: (category?: string, search?: string) =>
        containersApiClient.get<StoreApp[]>('/store/apps', { params: { category, search } }),
    getApp: (id: string) => containersApiClient.get<StoreApp>(`/store/apps/${id}`),
    installApp: (id: string, config?: Record<string, unknown>) =>
        containersApiClient.post(`/store/apps/${id}/install`, { config }),
    getCategories: () => containersApiClient.get<string[]>('/store/categories'),
    getAppDetails: (sourceId: string | undefined, appId: string) =>
        containersApiClient.get<AppDetails>(`/store/sources/${sourceId}/apps/${appId}/details`),
    install: (data: InstallRequest) =>
        containersApiClient.post<InstallResponse>('/store/install', data),
    installMulti: (data: InstallMultiRequest) =>
        containersApiClient.post<{ install_id: string }>('/store/install-multi', data),
    checkPorts: (ports: number[]) =>
        containersApiClient.post<PortConflict[]>('/store/check-ports', { ports }),
    refreshAll: () => containersApiClient.post('/store/refresh'),
    listSources: () => containersApiClient.get<AppSource[]>('/store/sources'),
    addSource: (data: { name: string; url: string }) =>
        containersApiClient.post<AppSource>('/store/sources', data),
    validateSource: (data: { name: string; url: string }) =>
        containersApiClient.post<{ valid: boolean; app_count?: number; error?: string }>('/store/sources/validate', data),
    deleteSource: (id: string) => containersApiClient.delete(`/store/sources/${id}`),
    refreshSource: (id: string) => containersApiClient.post(`/store/sources/${id}/refresh`),
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
    listProjects: () => containersApiClient.get<ComposeProject[]>('/compose/projects'),
    getProject: (name: string) => containersApiClient.get<ComposeProject>(`/compose/projects/${name}`),
    createProject: (name: string, content: string) =>
        containersApiClient.post<ComposeProject>('/compose/projects', { name, content }),
    updateProject: (name: string, content: string) =>
        containersApiClient.put<ComposeProject>(`/compose/projects/${name}`, { content }),
    deleteProject: (name: string, removeVolumes: boolean = false) =>
        containersApiClient.delete(`/compose/projects/${name}`, { params: { remove_volumes: removeVolumes } }),
    startProject: (name: string) => containersApiClient.post(`/compose/projects/${name}/start`),
    stopProject: (name: string) => containersApiClient.post(`/compose/projects/${name}/stop`),
    restartProject: (name: string) => containersApiClient.post(`/compose/projects/${name}/restart`),
    pullProject: (name: string) => containersApiClient.post(`/compose/projects/${name}/pull`),
    logs: (name: string, service?: string, lines: number = 100) =>
        containersApiClient.get<string>(`/compose/projects/${name}/logs`, { params: { service, lines } }),
    validate: (content: string) => containersApiClient.post('/compose/validate', { content }),
    preview: (content: string) =>
        containersApiClient.post<ComposePreviewResponse>('/compose/preview', { content }),
    import: (content: string, autoStart: boolean = true) =>
        containersApiClient.post<ComposeProject[]>('/compose/import', { content, auto_start: autoStart }),
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
        containersApiClient.get<ContainerInfo[]>('/containers', { params: { all } }),
    get: (id: string) => containersApiClient.get<ContainerInfo>(`/containers/${id}`),
    create: (data: CreateContainerRequest) => containersApiClient.post<ContainerInfo>('/containers', data),
    start: (id: string) => containersApiClient.post(`/containers/${id}/start`),
    stop: (id: string) => containersApiClient.post(`/containers/${id}/stop`),
    restart: (id: string) => containersApiClient.post(`/containers/${id}/restart`),
    delete: (id: string, force: boolean = false) =>
        containersApiClient.delete(`/containers/${id}`, { params: { force } }),
    logs: (id: string, tail: number = 100) =>
        containersApiClient.get<string>(`/containers/${id}/logs`, { params: { tail } }),
    stats: (id: string) => containersApiClient.get<ContainerStats>(`/containers/${id}/stats`),
    exec: (id: string, cmd: string[]) =>
        containersApiClient.post(`/containers/${id}/exec`, { cmd }),
    prune: () => containersApiClient.post('/containers/prune'),
    // Update container to latest image
    update: (id: string) => containersApiClient.post(`/containers/${id}/update`),
    // Remove container (alias for delete)
    remove: (id: string, force: boolean = false) =>
        containersApiClient.delete(`/containers/${id}`, { params: { force } }),
    // Docker-specific operations
    startDocker: (dockerId: string) =>
        containersApiClient.post(`/containers/docker/${dockerId}/start`),
    stopDocker: (dockerId: string) =>
        containersApiClient.post(`/containers/docker/${dockerId}/stop`),
    restartDocker: (dockerId: string) =>
        containersApiClient.post(`/containers/docker/${dockerId}/restart`),
    removeDocker: (dockerId: string, force: boolean = false) =>
        containersApiClient.delete(`/containers/docker/${dockerId}`, { params: { force } }),
    inspectDocker: (dockerId: string) =>
        containersApiClient.get<ContainerInfo>(`/containers/docker/${dockerId}/inspect`),
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
    listProfiles: () => containersApiClient.get<BackupProfile[]>('/backups/profiles'),
    getProfile: (id: string) => containersApiClient.get<BackupProfile>(`/backups/profiles/${id}`),
    createProfile: (data: CreateBackupProfileRequest) =>
        containersApiClient.post<BackupProfile>('/backups/profiles', data),
    updateProfile: (id: string, data: Partial<CreateBackupProfileRequest>) =>
        containersApiClient.put<BackupProfile>(`/backups/profiles/${id}`, data),
    deleteProfile: (id: string) => containersApiClient.delete(`/backups/profiles/${id}`),

    listBackups: (profileId?: string) =>
        containersApiClient.get<BackupItem[]>('/backups/list', { params: { profile_id: profileId } }),
    createBackup: (profileId: string) =>
        containersApiClient.post<BackupItem>(`/backups/profiles/${profileId}/run`),
    restoreBackup: (backupId: string) =>
        containersApiClient.post(`/backups/${backupId}/restore`),
    deleteBackup: (backupId: string) => containersApiClient.delete(`/backups/${backupId}`),
    downloadBackup: (backupId: string) =>
        containersApiClient.get(`/backups/${backupId}/download`, { responseType: 'blob' }),

    // Aliases used by the UI
    list: () => containersApiClient.get<{ profiles: BackupProfile[] }>('/backups/profiles'),
    create: (data: CreateBackupProfileRequest) =>
        containersApiClient.post<BackupProfile>('/backups/profiles', data),
    update: (id: string, data: Partial<BackupProfile>) =>
        containersApiClient.put<BackupProfile>(`/backups/profiles/${id}`, data),
    remove: (id: string) => containersApiClient.delete(`/backups/profiles/${id}`),
    run: (profileId: string) =>
        containersApiClient.post(`/backups/profiles/${profileId}/run`),
    snapshots: (profileId: string) =>
        containersApiClient.get<{ snapshots: BackupSnapshot[] }>(`/backups/profiles/${profileId}/snapshots`),
    restore: (profileId: string, snapshotId: string, targetPath?: string) =>
        containersApiClient.post(`/backups/profiles/${profileId}/restore`, { snapshot_id: snapshotId, target_path: targetPath }),
    runs: (profileId: string) =>
        containersApiClient.get<{ runs: BackupRun[] }>(`/backups/profiles/${profileId}/runs`),
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

export interface BackupSnapshot {
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
