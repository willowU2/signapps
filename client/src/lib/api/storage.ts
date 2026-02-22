import axios from 'axios';
import { storageApiClient, STORAGE_URL } from './core';

// Storage API
// Backend routes: /files/:bucket, /files/:bucket/*key, /permissions/:bucket/*key, /buckets
export const storageApi = {
    listBuckets: () => storageApiClient.get<Bucket[]>('/buckets'),
    createBucket: (name: string) => storageApiClient.post<Bucket>('/buckets', { name }),
    deleteBucket: (name: string) => storageApiClient.delete(`/buckets/${name}`),

    listFiles: (bucket: string, prefix: string = '', delimiter?: string) =>
        storageApiClient.get<ListObjectsResponse>(`/files/${bucket}`, { params: { prefix, delimiter } }),

    uploadFile: (bucket: string, file: File, onProgress?: (percent: number) => void) => {
        const formData = new FormData();
        formData.append('file', file);
        return storageApiClient.post(`/files/${bucket}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                }
            },
        });
    },

    // Alias for uploadFile used by various components
    upload: (bucket: string, file: File, path?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        if (path) {
            formData.append('path', path);
        }
        return storageApiClient.post(`/files/${bucket}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    deleteFile: (bucket: string, key: string) =>
        storageApiClient.delete(`/files/${bucket}/${encodeURIComponent(key)}`),

    // Alias for deleteFile
    delete: (bucket: string, key: string) =>
        storageApiClient.delete(`/files/${bucket}/${encodeURIComponent(key)}`),

    // Download a file
    download: (bucket: string, key: string) =>
        storageApiClient.get(`/files/${bucket}/${encodeURIComponent(key)}`, {
            responseType: 'arraybuffer',
        }),

    // Create folder (virtual) - uses PUT with empty body to create a key ending with /
    createFolder: (bucket: string, path: string) =>
        storageApiClient.put(`/files/${bucket}/${encodeURIComponent(path + '/')}`, new Uint8Array(0), {
            headers: { 'Content-Type': 'application/x-directory' },
        }),

    copy: (sourceBucket: string, sourceKey: string, destBucket: string, destKey: string) =>
        storageApiClient.post<ObjectInfo>('/files/copy', {
            source_bucket: sourceBucket,
            source_key: sourceKey,
            dest_bucket: destBucket,
            dest_key: destKey
        }),

    move: (sourceBucket: string, sourceKey: string, destBucket: string, destKey: string) =>
        storageApiClient.post<ObjectInfo>('/files/move', {
            source_bucket: sourceBucket,
            source_key: sourceKey,
            dest_bucket: destBucket,
            dest_key: destKey
        }),

    // Get file info
    getFileInfo: (bucket: string, key: string) =>
        storageApiClient.get<ObjectInfo>(`/files/${bucket}/info/${encodeURIComponent(key)}`),

    // Permissions
    getPermissions: (bucket: string, key: string) =>
        storageApiClient.get<FilePermissions>(`/permissions/${bucket}/${encodeURIComponent(key)}`),

    setPermissions: (bucket: string, key: string, data: { mode: number }) =>
        storageApiClient.put(`/permissions/${bucket}/${encodeURIComponent(key)}`, data),

    // Tags
    getTags: () => storageApiClient.get<any[]>('/tags'),
    createTag: (data: any) => storageApiClient.post('/tags', data),
    updateTag: (id: string, data: any) => storageApiClient.put(`/tags/${id}`, data),
    deleteTag: (id: string) => storageApiClient.delete(`/tags/${id}`),

    // File Tags
    getFileTags: (fileId: string) => storageApiClient.get<any[]>(`/files/${fileId}/tags`),
    addFileTag: (fileId: string, tagId: string) => storageApiClient.post(`/files/${fileId}/tags/${tagId}`),
    removeFileTag: (fileId: string, tagId: string) => storageApiClient.delete(`/files/${fileId}/tags/${tagId}`),

    // Versions
    getFileVersions: (fileId: string) => storageApiClient.get<any[]>(`/files/${fileId}/versions`),
    restoreFileVersion: (fileId: string, versionId: string) => storageApiClient.post(`/files/${fileId}/versions/${versionId}/restore`),
};

export interface Bucket {
    name: string;
    created_at: string;
    owner_id: string;
    size_bytes: number;
    object_count: number;
}

export interface FileInfo {
    key: string;
    size: number;
    last_modified: string;
    etag: string;
    content_type: string;
    is_directory?: boolean;
}

export interface ListObjectsResponse {
    objects: ObjectInfo[];
    prefixes: string[];
    is_truncated: boolean;
    next_continuation_token: string | null;
}

export interface ObjectInfo {
    key: string;
    size: number;
    last_modified: string | null;
    etag: string | null;
    content_type: string | null;
}

export interface FilePermissions {
    mode: number;
    owner_readable: boolean;
    owner_writable: boolean;
    owner_executable: boolean;
    group_readable: boolean;
    group_writable: boolean;
    group_executable: boolean;
    other_readable: boolean;
    other_writable: boolean;
    other_executable: boolean;
}

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

// Storage Management API (RAID, Disks, Mounts, External)

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
