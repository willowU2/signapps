/**
 * External Calendar Sync Components
 *
 * Components for connecting and syncing with external calendar providers.
 */

export { ProviderConnector } from './provider-connector';
export { SyncConfigPanel } from './sync-config-panel';

// Re-export types for convenience
export type {
  CalendarProvider,
  ProviderConnection,
  ExternalCalendar,
  SyncConfig,
  SyncDirection,
  ConflictResolution,
  SyncStatus,
} from '@/lib/calendar/external-sync/types';

export {
  PROVIDER_LABELS,
  PROVIDER_COLORS,
  SYNC_DIRECTION_LABELS,
  SYNC_STATUS_LABELS,
  CONFLICT_RESOLUTION_LABELS,
} from '@/lib/calendar/external-sync/types';
