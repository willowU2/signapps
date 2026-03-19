/**
 * Office Cache API
 *
 * API client for managing document cache.
 */

import { getClient, ServiceName } from '@/lib/api/factory';

const api = getClient(ServiceName.OFFICE);
import type {
  CacheEntry,
  CacheStats,
  CachePerformance,
  CacheConfig,
  CacheType,
  CacheLocation,
  CacheSetOptions,
  CacheGetOptions,
  CacheInvalidateOptions,
  ListCacheEntriesParams,
  ListCacheEntriesResponse,
  InvalidateCacheResponse,
  PrewarmCacheRequest,
  PrewarmCacheResponse,
} from './types';

const CACHE_BASE = '/api/v1/office/cache';

// ============================================================================
// Cache Entries
// ============================================================================

/**
 * List cache entries with optional filters
 */
export async function listCacheEntries(
  params?: ListCacheEntriesParams
): Promise<ListCacheEntriesResponse> {
  const queryParams = new URLSearchParams();

  if (params?.type) queryParams.append('type', params.type);
  if (params?.location) queryParams.append('location', params.location);
  if (params?.documentId) queryParams.append('documentId', params.documentId);
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));

  const response = await api.get<ListCacheEntriesResponse>(
    `${CACHE_BASE}/entries?${queryParams.toString()}`
  );
  return response.data;
}

/**
 * Get a specific cache entry metadata
 */
export async function getCacheEntry(key: string): Promise<CacheEntry | null> {
  try {
    const response = await api.get<CacheEntry>(
      `${CACHE_BASE}/entries/${encodeURIComponent(key)}`
    );
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Check if a cache entry exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    await api.head(`${CACHE_BASE}/entries/${encodeURIComponent(key)}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a specific cache entry
 */
export async function deleteCacheEntry(key: string): Promise<void> {
  await api.delete(`${CACHE_BASE}/entries/${encodeURIComponent(key)}`);
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Invalidate cache entries matching criteria
 */
export async function invalidateCache(
  options: CacheInvalidateOptions
): Promise<InvalidateCacheResponse> {
  const response = await api.post<InvalidateCacheResponse>(
    `${CACHE_BASE}/invalidate`,
    options
  );
  return response.data;
}

/**
 * Clear all cache entries
 */
export async function clearCache(): Promise<InvalidateCacheResponse> {
  const response = await api.post<InvalidateCacheResponse>(
    `${CACHE_BASE}/clear`,
    { force: true }
  );
  return response.data;
}

/**
 * Prewarm cache with specific content
 */
export async function prewarmCache(
  request: PrewarmCacheRequest
): Promise<PrewarmCacheResponse> {
  const response = await api.post<PrewarmCacheResponse>(
    `${CACHE_BASE}/prewarm`,
    request
  );
  return response.data;
}

/**
 * Trigger cache cleanup
 */
export async function triggerCleanup(): Promise<InvalidateCacheResponse> {
  const response = await api.post<InvalidateCacheResponse>(
    `${CACHE_BASE}/cleanup`
  );
  return response.data;
}

// ============================================================================
// Cache Statistics
// ============================================================================

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  const response = await api.get<CacheStats>(`${CACHE_BASE}/stats`);
  return response.data;
}

/**
 * Get cache performance metrics
 */
export async function getCachePerformance(
  period?: '1h' | '24h' | '7d' | '30d'
): Promise<CachePerformance> {
  const params = period ? `?period=${period}` : '';
  const response = await api.get<CachePerformance>(
    `${CACHE_BASE}/performance${params}`
  );
  return response.data;
}

/**
 * Get cache performance history
 */
export async function getCachePerformanceHistory(
  granularity?: 'hour' | 'day' | 'week'
): Promise<CachePerformance[]> {
  const params = granularity ? `?granularity=${granularity}` : '';
  const response = await api.get<CachePerformance[]>(
    `${CACHE_BASE}/performance/history${params}`
  );
  return response.data;
}

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Get cache configuration
 */
export async function getCacheConfig(): Promise<CacheConfig> {
  const response = await api.get<CacheConfig>(`${CACHE_BASE}/config`);
  return response.data;
}

/**
 * Update cache configuration
 */
export async function updateCacheConfig(
  config: Partial<CacheConfig>
): Promise<CacheConfig> {
  const response = await api.patch<CacheConfig>(`${CACHE_BASE}/config`, config);
  return response.data;
}

// ============================================================================
// Document-specific Cache
// ============================================================================

/**
 * Get cache entries for a specific document
 */
export async function getDocumentCacheEntries(
  documentId: string
): Promise<CacheEntry[]> {
  const response = await api.get<CacheEntry[]>(
    `${CACHE_BASE}/documents/${documentId}`
  );
  return response.data;
}

/**
 * Invalidate all cache for a document
 */
export async function invalidateDocumentCache(
  documentId: string
): Promise<InvalidateCacheResponse> {
  const response = await api.post<InvalidateCacheResponse>(
    `${CACHE_BASE}/documents/${documentId}/invalidate`
  );
  return response.data;
}

/**
 * Prewarm cache for a document
 */
export async function prewarmDocumentCache(
  documentId: string,
  types?: CacheType[]
): Promise<PrewarmCacheResponse> {
  const response = await api.post<PrewarmCacheResponse>(
    `${CACHE_BASE}/documents/${documentId}/prewarm`,
    { types }
  );
  return response.data;
}

// ============================================================================
// Export Cache Helpers
// ============================================================================

/**
 * Check if an export is cached
 */
export async function isExportCached(
  documentId: string,
  format: string,
  version?: string
): Promise<{ cached: boolean; entry?: CacheEntry }> {
  const params = new URLSearchParams({
    format,
    ...(version && { version }),
  });

  const response = await api.get<{ cached: boolean; entry?: CacheEntry }>(
    `${CACHE_BASE}/documents/${documentId}/export?${params.toString()}`
  );
  return response.data;
}

/**
 * Get cached export URL
 */
export async function getCachedExportUrl(
  documentId: string,
  format: string,
  version?: string
): Promise<{ url: string; expiresAt: string } | null> {
  try {
    const params = new URLSearchParams({
      format,
      ...(version && { version }),
    });

    const response = await api.get<{ url: string; expiresAt: string }>(
      `${CACHE_BASE}/documents/${documentId}/export/url?${params.toString()}`
    );
    return response.data;
  } catch {
    return null;
  }
}

// ============================================================================
// Export All
// ============================================================================

export const cacheApi = {
  // Entries
  listCacheEntries,
  getCacheEntry,
  cacheExists,
  deleteCacheEntry,
  // Operations
  invalidateCache,
  clearCache,
  prewarmCache,
  triggerCleanup,
  // Stats
  getCacheStats,
  getCachePerformance,
  getCachePerformanceHistory,
  // Config
  getCacheConfig,
  updateCacheConfig,
  // Document-specific
  getDocumentCacheEntries,
  invalidateDocumentCache,
  prewarmDocumentCache,
  // Export helpers
  isExportCached,
  getCachedExportUrl,
};

export default cacheApi;
