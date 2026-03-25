/**
 * Notifications API Module
 *
 * Connects to the notifications service on port 8095.
 * Endpoints: GET /api/notifications, GET /health
 */
import axios from 'axios';

const NOTIFICATIONS_BASE_URL =
  process.env.NEXT_PUBLIC_NOTIFICATIONS_URL || 'http://localhost:8095';

const notifClient = axios.create({
  baseURL: NOTIFICATIONS_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 10000,
});

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

// ─── API ──────────────────────────────────────────────────────────────────────

export const notificationsApi = {
  /** Fetch all notifications */
  list: () =>
    notifClient.get<Notification[]>('/api/notifications'),

  /** Health check */
  health: () =>
    notifClient.get('/health'),
};
