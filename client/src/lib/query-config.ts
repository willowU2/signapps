/**
 * Standardized React Query stale times.
 *
 * Rules:
 *  - STALE_LIST    : 30s   — paginated/filterable lists (contacts, docs, etc.)
 *  - STALE_STATIC  : 5min  — rarely-changing data (config, file-types, migrations)
 *  - STALE_REALTIME: 0     — always fresh (notifications, chat, live status)
 *
 * Usage:
 *   import { STALE_LIST } from '@/lib/query-config';
 *   useQuery({ queryKey: [...], queryFn: ..., staleTime: STALE_LIST });
 */
export const STALE_LIST = 30_000; // 30 seconds
export const STALE_STATIC = 5 * 60_000; // 5 minutes
export const STALE_REALTIME = 0; // always refetch
