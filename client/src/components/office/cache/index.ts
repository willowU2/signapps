/**
 * Office Cache Components
 *
 * Components for cache management and monitoring.
 */

// Components
export { CacheManager } from "./cache-manager";
export { CacheStatsWidget } from "./cache-stats-widget";

// Types
export type {
  CacheEntry,
  CacheStats,
  CachePerformance,
  CacheConfig,
  CacheType,
  CacheLocation,
  CacheStrategy,
  CacheSetOptions,
  CacheGetOptions,
  CacheInvalidateOptions,
} from "@/lib/office/cache/types";

// Constants
export {
  CACHE_TYPE_LABELS,
  CACHE_TYPE_COLORS,
  CACHE_LOCATION_LABELS,
  CACHE_STRATEGY_LABELS,
  DEFAULT_CACHE_CONFIG,
} from "@/lib/office/cache/types";

// API
export { cacheApi } from "@/lib/office/cache/api";

// Store
export { useCacheStore } from "@/stores/cache-store";
