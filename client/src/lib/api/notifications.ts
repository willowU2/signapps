/**
 * Notifications API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from "./factory";

const notifClient = getClient(ServiceName.NOTIFICATIONS);

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "system"
  | "mention"
  | "assignment"
  | "reminder"
  | "approval"
  | "share"
  | "comment"
  | "reaction";

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  module: string;
  source?: string;
  entity_type?: string;
  entity_id?: string;
  deep_link?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
}

export interface UnreadCountResponse {
  count: number;
}

export interface NotificationPreferences {
  id?: string;
  user_id?: string;
  channels?: {
    in_app: boolean;
    email: boolean;
    push: boolean;
  };
  email_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  digest_frequency?: "none" | "daily" | "weekly";
  muted_modules?: string[];
  per_service: Record<string, boolean>;
  created_at?: string;
  updated_at?: string;
}

export interface UpdatePreferencesRequest {
  channels?: { in_app?: boolean; email?: boolean; push?: boolean };
  email_enabled?: boolean;
  push_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  digest_frequency?: "none" | "daily" | "weekly";
  muted_modules?: string[];
  per_service?: Record<string, boolean>;
}

export interface ListNotificationsParams {
  unread_only?: boolean;
  type?: NotificationType;
  module?: string;
  cursor?: string;
  limit?: number;
}

export interface CreateNotificationRequest {
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  module: string;
  entity_type?: string;
  entity_id?: string;
  deep_link?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const notificationsApi = {
  /** List notifications with optional filters and cursor pagination. */
  list: (params?: ListNotificationsParams) =>
    notifClient.get<NotificationItem[]>("/notifications", { params }),

  /** Get unread notification count. */
  unreadCount: () =>
    notifClient.get<UnreadCountResponse>("/notifications/unread-count"),

  /** Create a notification (internal, used by other services). */
  create: (data: CreateNotificationRequest) =>
    notifClient.post<NotificationItem>("/notifications", data),

  /** Mark a single notification as read. */
  markRead: (id: string) =>
    notifClient.put<NotificationItem>(`/notifications/${id}/read`),

  /** Mark all notifications as read. */
  markAllRead: () =>
    notifClient.put<{ updated: number }>("/notifications/read-all"),

  /** Delete a notification. */
  delete: (id: string) => notifClient.delete(`/notifications/${id}`),

  /** Get user notification preferences. */
  getPreferences: () =>
    notifClient.get<NotificationPreferences>("/notifications/preferences"),

  /** Update user notification preferences (partial). */
  updatePreferences: (data: UpdatePreferencesRequest) =>
    notifClient.put<NotificationPreferences>(
      "/notifications/preferences",
      data,
    ),

  /** Health check. */
  health: () => notifClient.get("/health"),
};
