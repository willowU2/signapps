/**
 * Storage API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import axios from "axios";
import { getClient, getServiceBaseUrl, ServiceName } from "./factory";

// Get the storage service client (cached)
const storageClient = getClient(ServiceName.STORAGE);
const STORAGE_URL = getServiceBaseUrl(ServiceName.STORAGE);

export interface UploadResponse {
  id: string;
  bucket: string;
  key: string;
  size: number;
  content_type: string;
}

// Storage API
// Backend routes: /files/:bucket, /files/:bucket/*key, /permissions/:bucket/*key, /buckets
export const storageApi = {
  listBuckets: () => storageClient.get<Bucket[]>("/buckets"),
  getBucket: (name: string) => storageClient.get<Bucket>(`/buckets/${name}`),
  createBucket: (name: string) =>
    storageClient.post<Bucket>("/buckets", { name }),
  deleteBucket: (name: string) => storageClient.delete(`/buckets/${name}`),

  // Drive Nodes
  getNodes: () => storageClient.get("/drive/nodes"),
  getRootNodes: () => storageClient.get("/drive/nodes/root"),
  getNodeChildren: (id: string) =>
    storageClient.get(`/drive/nodes/${id}/children`),

  listFiles: (bucket: string, prefix: string = "", delimiter?: string) =>
    storageClient.get<ListObjectsResponse>(`/files/${bucket}`, {
      params: { prefix, delimiter },
    }),

  uploadFile: (
    bucket: string,
    file: File,
    onProgress?: (percent: number) => void,
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    return storageClient.post<UploadResponse[]>(`/files/${bucket}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(
            Math.round((progressEvent.loaded * 100) / progressEvent.total),
          );
        }
      },
    });
  },

  // Alias for uploadFile used by various components
  upload: (bucket: string, file: File, path?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (path) {
      formData.append("path", path);
    }
    return storageClient.post<UploadResponse[]>(`/files/${bucket}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  deleteFile: (bucket: string, key: string) =>
    storageClient.delete(`/files/${bucket}/${encodeURIComponent(key)}`),

  // Alias for deleteFile
  delete: (bucket: string, key: string) =>
    storageClient.delete(`/files/${bucket}/${encodeURIComponent(key)}`),

  // Update an existing file by its exact key
  uploadWithKey: (bucket: string, key: string, file: File | Blob) => {
    const url = `/files/${bucket}/${key}`;
    // Since the backend upload_with_key route accepts the raw body for the file content
    // and expects content-type header, we will send the blob directly.
    return storageClient.put<UploadResponse>(url, file, {
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
  },

  // Download a file
  downloadFile: async (bucket: string, key: string): Promise<Blob> => {
    const url = `/files/${bucket}/${key}?t=${Date.now()}`;
    const response = await storageClient.get(url, {
      responseType: "blob",
    });
    return response.data;
  },

  // Alias pour download
  download: async (bucket: string, key: string) => {
    const response = await storageClient.get(
      `/files/${bucket}/${encodeURIComponent(key)}?t=${Date.now()}`,
      {
        responseType: "arraybuffer",
      },
    );
    return response.data;
  },

  // Create folder (virtual) - uses PUT with empty body to create a key ending with /
  createFolder: (bucket: string, path: string) =>
    storageClient.put(
      `/files/${bucket}/${encodeURIComponent(path + "/")}`,
      new Uint8Array(0),
      {
        headers: { "Content-Type": "application/x-directory" },
      },
    ),

  copy: (
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ) =>
    storageClient.post<ObjectInfo>("/files/copy", {
      source_bucket: sourceBucket,
      source_key: sourceKey,
      dest_bucket: destBucket,
      dest_key: destKey,
    }),

  move: (
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ) =>
    storageClient.post<ObjectInfo>("/files/move", {
      source_bucket: sourceBucket,
      source_key: sourceKey,
      dest_bucket: destBucket,
      dest_key: destKey,
    }),

  // Get file info
  getFileInfo: (bucket: string, key: string) =>
    storageClient.get<ObjectInfo>(
      `/files/${bucket}/info/${encodeURIComponent(key)}`,
    ),

  // Permissions
  getPermissions: (bucket: string, key: string) =>
    storageClient.get<FilePermissions>(
      `/permissions/${bucket}/${encodeURIComponent(key)}`,
    ),

  setPermissions: (bucket: string, key: string, data: { mode: number }) =>
    storageClient.put(
      `/permissions/${bucket}/${encodeURIComponent(key)}`,
      data,
    ),

  // Tags
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTags: () => storageClient.get<any[]>("/tags"),
  createTag: (data: Record<string, unknown>) =>
    storageClient.post("/tags", data),
  updateTag: (id: string, data: Record<string, unknown>) =>
    storageClient.put(`/tags/${id}`, data),
  deleteTag: (id: string) => storageClient.delete(`/tags/${id}`),

  // File Tags

  getFileTags: (fileId: string) =>
    storageClient.get<any[]>(`/files/${fileId}/tags`),
  addFileTag: (fileId: string, tagId: string) =>
    storageClient.post(`/files/${fileId}/tags/${tagId}`),
  removeFileTag: (fileId: string, tagId: string) =>
    storageClient.delete(`/files/${fileId}/tags/${tagId}`),

  // Versions

  getFileVersions: (fileId: string) =>
    storageClient.get<any[]>(`/files/${fileId}/versions`),
  restoreFileVersion: (fileId: string, versionId: string) =>
    storageClient.post(`/files/${fileId}/versions/${versionId}/restore`),
  downloadFileVersion: (fileId: string, versionId: string) =>
    storageClient.get(`/files/${fileId}/versions/${versionId}/download`, {
      responseType: "arraybuffer",
    }),

  // Quota
  getQuota: () => storageClient.get("/quotas/me"),

  // Full-text search within file contents
  searchContent: (params: { q: string; bucket?: string; limit?: number }) =>
    storageClient.get<ContentSearchResult[]>("/search/content", { params }),
};

export interface ContentSearchResult {
  file_id: string;
  bucket: string;
  key: string;
  name: string;
  snippet: string;
  score: number;
  last_modified: string;
}

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
    storageClient.get<ShareListResponse>("/shares", {
      params: { bucket, active_only: activeOnly },
    }),
  create: (data: CreateShareRequest) =>
    storageClient.post<CreateShareResponse>("/shares", data),
  get: (id: string) => storageClient.get<ShareLink>(`/shares/${id}`),
  update: (id: string, data: UpdateShareRequest) =>
    storageClient.put<ShareLink>(`/shares/${id}`, data),
  delete: (id: string) => storageClient.delete(`/shares/${id}`),
  // Public access (no auth)
  access: (token: string, password?: string) =>
    axios.post<ShareAccessResponse>(
      `${STORAGE_URL}/api/v1/shares/${token}/access`,
      { password },
    ),
  download: (token: string) =>
    storageClient.get(`/shares/${token}/download`, { responseType: "blob" }),
  downloadUrl: (token: string) =>
    `${STORAGE_URL}/api/v1/shares/${token}/download`,
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
  access_type: "view" | "download" | "edit";
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
  access_type?: "view" | "download" | "edit";
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
  access_type?: "view" | "download" | "edit";
  is_active?: boolean;
}

export interface ShareAccessResponse {
  bucket: string;
  key: string;
  filename: string;
  size: number;
  content_type: string;
  access_type: "view" | "download" | "edit";
  download_url?: string;
}

// Trash API
export const trashApi = {
  list: (bucket?: string, search?: string, limit?: number, offset?: number) =>
    storageClient.get<TrashListResponse>("/trash", {
      params: { bucket, search, limit, offset },
    }),
  get: (id: string) => storageClient.get<TrashItem>(`/trash/${id}`),
  moveToTrash: (bucket: string, keys: string[]) =>
    storageClient.post<MoveToTrashResponse>("/trash", { bucket, keys }),
  restore: (
    items: string[],
    destination?: { bucket: string; prefix?: string },
  ) =>
    storageClient.post<RestoreResponse>("/trash/restore", {
      items,
      destination,
    }),
  delete: (id: string) => storageClient.delete(`/trash/${id}`),
  empty: (items?: string[]) => storageClient.delete("/trash", { data: items }),
  stats: () => storageClient.get<TrashStats>("/trash/stats"),
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
    storageClient.get<FavoritesListResponse>("/favorites", {
      params: { bucket, folders_only: foldersOnly },
    }),
  add: (data: AddFavoriteRequest) =>
    storageClient.post<Favorite>("/favorites", data),
  get: (id: string) => storageClient.get<FavoriteWithInfo>(`/favorites/${id}`),
  update: (id: string, data: UpdateFavoriteRequest) =>
    storageClient.put<Favorite>(`/favorites/${id}`, data),
  remove: (id: string) => storageClient.delete(`/favorites/${id}`),
  removeByPath: (bucket: string, key: string) =>
    storageClient.delete(
      `/favorites/path/${bucket}/${encodeURIComponent(key)}`,
    ),
  check: (bucket: string, key: string) =>
    storageClient.get<boolean>(
      `/favorites/check/${bucket}/${encodeURIComponent(key)}`,
    ),
  reorder: (order: string[]) =>
    storageClient.post("/favorites/reorder", { order }),
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
    storageClient.get<SearchResponse>("/search", {
      params: { q: query, ...options },
    }),
  quickSearch: (query: string, limit?: number) =>
    storageClient.get<QuickSearchResponse>("/search/quick", {
      params: { q: query, limit },
    }),
  recent: (limit?: number) =>
    storageClient.get<QuickSearchResult[]>("/search/recent", {
      params: { limit },
    }),
  suggest: (query: string) =>
    storageClient.get<string[]>("/search/suggest", { params: { q: query } }),
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
  sort_by?: "name" | "size" | "modified" | "relevance";
  sort_order?: "asc" | "desc";
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
  modified_at?: string;
}

// Quotas API
export const quotasApi = {
  getMyQuota: () => storageClient.get<QuotaUsage>("/quotas/me"),
  getAlerts: () => storageClient.get<QuotaAlert[]>("/quotas/me/alerts"),
  getUserQuota: (userId: string) =>
    storageClient.get<QuotaUsage>(`/quotas/users/${userId}`),
  setUserQuota: (userId: string, quota: SetQuotaRequest) =>
    storageClient.put<StorageQuota>(`/quotas/users/${userId}`, quota),
  deleteUserQuota: (userId: string) =>
    storageClient.delete(`/quotas/users/${userId}`),
  recalculate: (userId: string) =>
    storageClient.post<QuotaUsage>(`/quotas/users/${userId}/recalculate`),
  getUsersOverLimit: () =>
    storageClient.get<QuotaUsage[]>("/quotas/over-limit"),
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
  alert_type: "warning" | "critical" | "exceeded";
  resource: string;
  current: number;
  limit: number;
  percentage: number;
  message: string;
}

// Preview API
export const previewApi = {
  getInfo: (bucket: string, key: string) =>
    storageClient.get<PreviewInfo>(
      `/preview/info/${bucket}/${encodeURIComponent(key)}`,
    ),
  getThumbnailUrl: (
    bucket: string,
    key: string,
    size?: "small" | "medium" | "large",
  ) =>
    `${STORAGE_URL}/api/v1/preview/thumbnail/${bucket}/${encodeURIComponent(key)}?size=${size || "medium"}`,
  getPreviewUrl: (bucket: string, key: string) =>
    `${STORAGE_URL}/api/v1/preview/view/${bucket}/${encodeURIComponent(key)}`,

  getArchiveListing: (bucket: string, key: string) =>
    storageClient.get<any[]>(
      `/preview/archive/${bucket}/${encodeURIComponent(key)}`,
    ),
  getDocumentMetadata: (bucket: string, key: string) =>
    storageClient.get<Record<string, string>>(
      `/preview/document-metadata/${bucket}/${encodeURIComponent(key)}`,
    ),
};

export interface PreviewInfo {
  previewable: boolean;
  preview_type:
    | "image"
    | "pdf"
    | "document"
    | "video"
    | "audio"
    | "text"
    | "code"
    | "none";
  pages?: number;
  thumbnail_url?: string;
  preview_url?: string;
}

// Storage Management API (RAID, Disks, Mounts, External)

// RAID API
export const raidApi = {
  // Arrays
  listArrays: () => storageClient.get<RaidArray[]>("/raid/arrays"),
  getArray: (id: string) => storageClient.get<RaidArray>(`/raid/arrays/${id}`),
  getArrayByName: (name: string) =>
    storageClient.get<RaidArray>(`/raid/arrays/name/${name}`),
  createArray: (data: CreateRaidArrayRequest) =>
    storageClient.post<RaidArray>("/raid/arrays", data),
  deleteArray: (id: string) => storageClient.delete(`/raid/arrays/${id}`),
  rebuildArray: (id: string) =>
    storageClient.post(`/raid/arrays/${id}/rebuild`),
  addDiskToArray: (arrayId: string, diskId: string) =>
    storageClient.post(`/raid/arrays/${arrayId}/disks`, { disk_id: diskId }),
  removeDiskFromArray: (arrayId: string, diskId: string) =>
    storageClient.delete(`/raid/arrays/${arrayId}/disks/${diskId}`),
  getArrayEvents: (arrayId: string, limit?: number) =>
    storageClient.get<RaidEvent[]>(`/raid/arrays/${arrayId}/events`, {
      params: { limit },
    }),

  // Disks
  listDisks: () => storageClient.get<DiskInfo[]>("/raid/disks"),
  getDisk: (id: string) => storageClient.get<DiskInfo>(`/raid/disks/${id}`),
  scanDisks: () => storageClient.post<DiskInfo[]>("/raid/disks/scan"),

  // Events & Health
  listEvents: (limit?: number, severity?: string) =>
    storageClient.get<RaidEvent[]>("/raid/events", {
      params: { limit, severity },
    }),
  getHealth: () => storageClient.get<RaidHealth>("/raid/health"),
};

export interface RaidArray {
  id: string;
  name: string;
  device_path: string;
  raid_level:
    | "raid0"
    | "raid1"
    | "raid5"
    | "raid6"
    | "raid10"
    | "raidz"
    | "raidz2";
  status: "active" | "degraded" | "rebuilding" | "failed" | "inactive";
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
  status: "healthy" | "warning" | "failing" | "failed" | "spare";
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
  severity: "info" | "warning" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RaidHealth {
  status: "healthy" | "warning" | "critical";
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
  getStats: () => storageClient.get<StorageStats>("/stats"),
};

export interface StorageStats {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  buckets_count: number;
  files_count: number;
  arrays_count: number;
  health_status: "healthy" | "warning" | "critical";
}

// Mounts API (requires backend implementation)
export const mountsApi = {
  list: () => storageClient.get<MountPoint[]>("/mounts"),
  mount: (data: MountRequest) => storageClient.post("/mounts", data),
  unmount: (mountPoint: string) =>
    storageClient.delete(`/mounts/${encodeURIComponent(mountPoint)}`),
  getInfo: (mountPoint: string) =>
    storageClient.get<MountPoint>(`/mounts/${encodeURIComponent(mountPoint)}`),
};

// Indexing & Storage Rules API
export const rulesApi = {
  getStorageRules: () => storageClient.get("/storage_rules"),
  createStorageRule: (data: Record<string, unknown>) =>
    storageClient.post("/storage_rules", data),
  updateStorageRule: (id: string, data: Record<string, unknown>) =>
    storageClient.put(`/storage_rules/${id}`, data),
  deleteStorageRule: (id: string) =>
    storageClient.delete(`/storage_rules/${id}`),

  getIndexingRules: () => storageClient.get("/indexing_rules"),
  createIndexingRule: (data: Record<string, unknown>) =>
    storageClient.post("/indexing_rules", data),
  updateIndexingRule: (id: string, data: Record<string, unknown>) =>
    storageClient.put(`/indexing_rules/${id}`, data),
  deleteIndexingRule: (id: string) =>
    storageClient.delete(`/indexing_rules/${id}`),

  getSettings: (key: string) => storageClient.get(`/settings/${key}`),
  updateSettings: (key: string, data: Record<string, unknown>) =>
    storageClient.put(`/settings/${key}`, data),
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
  list: () => storageClient.get<ExternalStorage[]>("/external"),
  detect: () => storageClient.post<ExternalStorage[]>("/external/detect"),
  connect: (data: ConnectExternalRequest) =>
    storageClient.post<ExternalStorage>("/external", data),
  disconnect: (id: string) => storageClient.delete(`/external/${id}`),
  getStatus: (id: string) =>
    storageClient.get<ExternalStorage>(`/external/${id}`),
  eject: (id: string) => storageClient.post(`/external/${id}/eject`),
};

export interface ExternalStorage {
  id: string;
  name: string;
  type: "usb" | "nas" | "smb" | "nfs" | "s3" | "cloud";
  connection_string?: string;
  mount_point?: string;
  size_bytes?: number;
  used_bytes?: number;
  status: "connected" | "disconnected" | "mounting" | "error";
  error_message?: string;
  last_seen?: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectExternalRequest {
  name: string;
  type: "smb" | "nfs" | "s3";
  connection_string: string;
  mount_point?: string;
  username?: string;
  password?: string;
  options?: Record<string, string>;
}

// ─── Drive ACL API ──────────────────────────────────────────

export type AclRole =
  | "viewer"
  | "downloader"
  | "editor"
  | "contributor"
  | "manager";
export type GranteeType = "user" | "group" | "everyone";

export interface DriveAcl {
  id: string;
  node_id: string;
  grantee_type: GranteeType;
  grantee_id?: string;
  role: AclRole;
  inherit: boolean;
  granted_by: string;
  expires_at?: string;
  grantee_name?: string;
}

export interface EffectiveAcl {
  node_id: string;
  user_id: string;
  role: AclRole | null;
  is_owner: boolean;
  inherited_from?: string;
  grants: DriveAcl[];
}

export interface AuditLogEntry {
  id: string;
  node_id?: string;
  node_path: string;
  action: string;
  actor_id: string;
  actor_ip?: string;
  actor_geo?: string;
  file_hash?: string;
  details: Record<string, unknown>;
  log_hash: string;
  created_at: string;
  actor_name?: string;
}

export interface ChainVerification {
  valid: boolean;
  total_entries: number;
  first_corrupt_index?: number;
}

export const driveAclApi = {
  list: (nodeId: string) =>
    storageClient.get<DriveAcl[]>(`/drive/nodes/${nodeId}/acl`),
  create: (
    nodeId: string,
    data: {
      grantee_type: GranteeType;
      grantee_id?: string;
      role: AclRole;
      inherit?: boolean;
      expires_at?: string;
    },
  ) => storageClient.post<DriveAcl>(`/drive/nodes/${nodeId}/acl`, data),
  update: (
    nodeId: string,
    aclId: string,
    data: { role?: AclRole; expires_at?: string },
  ) => storageClient.put<DriveAcl>(`/drive/nodes/${nodeId}/acl/${aclId}`, data),
  delete: (nodeId: string, aclId: string) =>
    storageClient.delete(`/drive/nodes/${nodeId}/acl/${aclId}`),
  breakInheritance: (nodeId: string) =>
    storageClient.post(`/drive/nodes/${nodeId}/acl/break`),
  restoreInheritance: (nodeId: string) =>
    storageClient.post(`/drive/nodes/${nodeId}/acl/restore`),
  effective: (nodeId: string) =>
    storageClient.get<EffectiveAcl>(`/drive/nodes/${nodeId}/effective-acl`),
};

export const driveAuditApi = {
  list: (params: {
    node_id?: string;
    actor_id?: string;
    action?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }) => storageClient.get<AuditLogEntry[]>("/drive/audit", { params }),
  verify: () => storageClient.get<ChainVerification>("/drive/audit/verify"),
  export: (params: {
    format: "csv" | "json";
    date_from?: string;
    date_to?: string;
  }) =>
    storageClient.post("/drive/audit/export", params, { responseType: "blob" }),
  alerts: () => storageClient.get("/drive/audit/alerts"),
  alertConfig: () => storageClient.get("/drive/audit/alerts/config"),
  updateAlertConfig: (data: unknown) =>
    storageClient.put("/drive/audit/alerts/config", data),
};

// ============================================================
// Drive SP3 Backup API
// ============================================================

export interface BackupPlan {
  id: string;
  name: string;
  schedule: string;
  backup_type: "full" | "incremental" | "differential";
  retention_days: number;
  max_snapshots: number;
  include_paths: string[];
  exclude_paths: string[];
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBackupPlan {
  name: string;
  schedule?: string;
  backup_type?: "full" | "incremental" | "differential";
  retention_days?: number;
  max_snapshots?: number;
  include_paths?: string[];
  exclude_paths?: string[];
  enabled?: boolean;
}

export interface UpdateBackupPlan {
  name?: string;
  schedule?: string;
  backup_type?: "full" | "incremental" | "differential";
  retention_days?: number;
  max_snapshots?: number;
  include_paths?: string[];
  exclude_paths?: string[];
  enabled?: boolean;
}

export interface BackupSnapshot {
  id: string;
  plan_id: string;
  backup_type: "full" | "incremental" | "differential";
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  files_count: number;
  total_size: number;
  storage_path: string | null;
  error_message: string | null;
  created_at: string;
}

export interface BackupEntry {
  id: string;
  snapshot_id: string;
  node_id: string | null;
  node_path: string;
  file_hash: string | null;
  file_size: number;
  backup_key: string;
  created_at: string;
}

export interface BackupSnapshotDetail extends BackupSnapshot {
  entries: BackupEntry[];
}

export interface RestoreRequest {
  snapshot_id: string;
  node_path?: string;
  target_path?: string;
}

export interface RestoreResponse {
  message: string;
  restored_files: number;
}

export const backupApi = {
  // Plans
  listPlans: () => storageClient.get<BackupPlan[]>("/backups/plans"),
  createPlan: (data: CreateBackupPlan) =>
    storageClient.post<BackupPlan>("/backups/plans", data),
  updatePlan: (id: string, data: UpdateBackupPlan) =>
    storageClient.put<BackupPlan>(`/backups/plans/${id}`, data),
  deletePlan: (id: string) => storageClient.delete(`/backups/plans/${id}`),
  runPlan: (id: string) =>
    storageClient.post<BackupSnapshot>(`/backups/plans/${id}/run`),

  // Snapshots
  listSnapshots: (plan_id?: string) =>
    storageClient.get<BackupSnapshot[]>("/backups/snapshots", {
      params: plan_id ? { plan_id } : {},
    }),
  getSnapshot: (id: string) =>
    storageClient.get<BackupSnapshotDetail>(`/backups/snapshots/${id}`),
  deleteSnapshot: (id: string) =>
    storageClient.delete(`/backups/snapshots/${id}`),

  // Restore
  restore: (req: RestoreRequest) =>
    storageClient.post<RestoreResponse>("/backups/restore", req),
};

// ─── WebDAV Configuration API ─────────────────────────────────────────────────

export interface WebDavConfigResponse {
  enabled: boolean;
  url: string;
}

export const webdavApi = {
  /** GET /api/v1/webdav/config — global WebDAV status and URL */
  getConfig: () => storageClient.get<WebDavConfigResponse>("/webdav/config"),

  /** PUT /api/v1/webdav/config — enable or disable WebDAV globally */
  updateConfig: (data: { enabled: boolean }) =>
    storageClient.put<WebDavConfigResponse>("/webdav/config", data),
};
