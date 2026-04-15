/**
 * Office Cache Types
 *
 * Types for document caching and export optimization.
 */

// ============================================================================
// Cache Entry Types
// ============================================================================

export type CacheType =
  | "document_content"
  | "document_preview"
  | "export_result"
  | "conversion_result"
  | "thumbnail"
  | "template"
  | "font"
  | "image";

export type CacheStrategy =
  | "lru" // Least Recently Used
  | "lfu" // Least Frequently Used
  | "ttl" // Time-To-Live based
  | "priority"; // Priority-based eviction

export type CacheLocation =
  | "memory" // In-memory cache (fast, volatile)
  | "disk" // Disk cache (slower, persistent)
  | "cdn"; // CDN cache (distributed)

// ============================================================================
// Cache Entry
// ============================================================================

export interface CacheEntry {
  key: string;
  type: CacheType;
  location: CacheLocation;
  size: number; // bytes
  createdAt: string;
  accessedAt: string;
  expiresAt?: string;
  hitCount: number;
  priority: number; // 1-10, higher = more important

  // Metadata
  documentId?: string;
  documentName?: string;
  format?: string;
  version?: string;
  checksum?: string;

  // TTL settings
  ttlSeconds?: number;
  staleWhileRevalidate?: boolean;
}

export interface CacheEntryWithData extends CacheEntry {
  data: string | Blob | ArrayBuffer;
  contentType: string;
}

// ============================================================================
// Cache Statistics
// ============================================================================

export interface CacheStats {
  // Size metrics
  totalSize: number;
  maxSize: number;
  usedPercentage: number;

  // Entry counts
  totalEntries: number;
  entriesByType: Record<CacheType, number>;
  entriesByLocation: Record<CacheLocation, number>;

  // Performance metrics
  hitCount: number;
  missCount: number;
  hitRate: number; // percentage

  // Time metrics
  averageAccessTime: number; // ms
  lastCleanup: string;
  nextCleanup?: string;
}

export interface CachePerformance {
  period: string; // e.g., "1h", "24h", "7d"
  hits: number;
  misses: number;
  hitRate: number;
  bytesServed: number;
  bytesSaved: number; // vs. regenerating
  averageLatency: number;
  peakLatency: number;
}

// ============================================================================
// Cache Configuration
// ============================================================================

export interface CacheConfig {
  // Global settings
  enabled: boolean;
  strategy: CacheStrategy;
  maxTotalSize: number; // bytes

  // Location-specific limits
  memoryLimit: number;
  diskLimit: number;

  // TTL defaults by type
  ttlByType: Partial<Record<CacheType, number>>;

  // Priority settings
  priorityByType: Partial<Record<CacheType, number>>;

  // Cleanup settings
  cleanupInterval: number; // seconds
  cleanupThreshold: number; // percentage of maxSize

  // Prewarming
  prewarmEnabled: boolean;
  prewarmTypes: CacheType[];
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  strategy: "lru",
  maxTotalSize: 500 * 1024 * 1024, // 500MB

  memoryLimit: 100 * 1024 * 1024, // 100MB
  diskLimit: 400 * 1024 * 1024, // 400MB

  ttlByType: {
    document_content: 3600, // 1 hour
    document_preview: 1800, // 30 min
    export_result: 86400, // 24 hours
    conversion_result: 86400,
    thumbnail: 604800, // 7 days
    template: 86400,
    font: 2592000, // 30 days
    image: 604800,
  },

  priorityByType: {
    document_content: 8,
    document_preview: 6,
    export_result: 7,
    conversion_result: 7,
    thumbnail: 5,
    template: 9,
    font: 10,
    image: 4,
  },

  cleanupInterval: 300, // 5 minutes
  cleanupThreshold: 90, // cleanup at 90% capacity

  prewarmEnabled: true,
  prewarmTypes: ["font", "template"],
};

// ============================================================================
// Cache Operations
// ============================================================================

export interface CacheSetOptions {
  ttlSeconds?: number;
  priority?: number;
  location?: CacheLocation;
  staleWhileRevalidate?: boolean;
}

export interface CacheGetOptions {
  allowStale?: boolean;
  refresh?: boolean;
}

export interface CacheInvalidateOptions {
  type?: CacheType;
  documentId?: string;
  pattern?: string; // key pattern
  olderThan?: string; // ISO date
  force?: boolean;
}

// ============================================================================
// API Requests/Responses
// ============================================================================

export interface ListCacheEntriesParams {
  type?: CacheType;
  location?: CacheLocation;
  documentId?: string;
  sortBy?: "size" | "accessedAt" | "hitCount" | "priority";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ListCacheEntriesResponse {
  entries: CacheEntry[];
  total: number;
  hasMore: boolean;
}

export interface InvalidateCacheResponse {
  invalidatedCount: number;
  freedBytes: number;
}

export interface PrewarmCacheRequest {
  documentIds?: string[];
  types?: CacheType[];
  templates?: string[];
}

export interface PrewarmCacheResponse {
  scheduled: number;
  skipped: number; // already cached
}

// ============================================================================
// Constants
// ============================================================================

export const CACHE_TYPE_LABELS: Record<CacheType, string> = {
  document_content: "Contenu document",
  document_preview: "Aperçu document",
  export_result: "Export",
  conversion_result: "Conversion",
  thumbnail: "Miniature",
  template: "Template",
  font: "Police",
  image: "Image",
};

export const CACHE_TYPE_COLORS: Record<CacheType, string> = {
  document_content: "bg-blue-100 text-blue-800",
  document_preview: "bg-purple-100 text-purple-800",
  export_result: "bg-green-100 text-green-800",
  conversion_result: "bg-yellow-100 text-yellow-800",
  thumbnail: "bg-pink-100 text-pink-800",
  template: "bg-indigo-100 text-indigo-800",
  font: "bg-gray-100 text-gray-800",
  image: "bg-orange-100 text-orange-800",
};

export const CACHE_LOCATION_LABELS: Record<CacheLocation, string> = {
  memory: "Mémoire",
  disk: "Disque",
  cdn: "CDN",
};

export const CACHE_STRATEGY_LABELS: Record<CacheStrategy, string> = {
  lru: "Moins récemment utilisé",
  lfu: "Moins fréquemment utilisé",
  ttl: "Basé sur TTL",
  priority: "Basé sur priorité",
};
