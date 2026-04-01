/**
 * Notifications API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';

const notifClient = getClient(ServiceName.NOTIFICATIONS);

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'info' | 'warning' | 'alert' | 'success';
export type NotificationPriority = 'high' | 'medium' | 'low';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  read: boolean;
  created_at: string;
  source: string;
}

// ─── Preferences types ────────────────────────────────────────────────────────

export interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  per_service: Record<string, boolean>;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: () =>
    notifClient.get<Notification[]>('/notifications'),

  health: () =>
    notifClient.get('/health'),

  markRead: (id: string) =>
    notifClient.patch(`/notifications/${id}/read`, {}),

  markAllRead: () =>
    notifClient.post('/notifications/read-all', {}),

  getPreferences: () =>
    notifClient.get<NotificationPreferences>('/notifications/preferences'),

  patchPreferences: (patch: Partial<NotificationPreferences>) =>
    notifClient.patch<NotificationPreferences>('/notifications/preferences', patch),
};
