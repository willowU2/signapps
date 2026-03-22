import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { notificationsApi, type NotificationRecord } from '@/lib/api/calendar';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'container'
  | 'security'
  | 'storage'
  | 'user'
  | 'system';

export type NotificationStatus = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, NotificationType> = {
  event_reminder: 'system',
  event_invitation: 'user',
  attendee_rsvp: 'user',
  task_assigned: 'system',
  task_completed: 'system',
  daily_digest: 'system',
  weekly_digest: 'system',
  container: 'container',
  security: 'security',
  storage: 'storage',
};

const STATUS_MAP: Record<string, NotificationStatus> = {
  pending: 'info',
  sent: 'success',
  failed: 'error',
  delivered: 'success',
};

export function mapRecordToNotification(record: NotificationRecord): AppNotification {
  return {
    id: record.id,
    type: TYPE_MAP[record.notification_type] ?? 'system',
    status: STATUS_MAP[record.status] ?? 'info',
    title: record.notification_type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    description: record.recipient_address
      ? `Envoyé à ${record.recipient_address}`
      : `Via ${record.channel}`,
    timestamp: new Date(record.created_at),
    read: record.status === 'sent' || record.status === 'delivered',
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface NotificationState {
  notifications: AppNotification[];
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
}

interface NotificationActions {
  setOpen: (open: boolean) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  pushSSENotification: (notification: Partial<AppNotification> & { id: string; title: string; description: string }) => void;
}

export type NotificationStore = NotificationState & NotificationActions;

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  notifications: [],
  isLoading: false,
  error: null,
  isOpen: false,

  setOpen: (open) => {
    set({ isOpen: open });
    if (open) {
      get().fetchNotifications();
    }
  },

  fetchNotifications: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await notificationsApi.getHistory({ limit: 30 });
      set({
        notifications: response.data.notifications.map(mapRecordToNotification),
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: 'Impossible de charger les notifications' });
    }
  },

  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  remove: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),

  pushSSENotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          type: 'system',
          status: 'info',
          timestamp: new Date(),
          read: false,
          ...notification,
        },
        ...state.notifications,
      ],
    })),
}));

// ─── Granular selectors ───────────────────────────────────────────────────────

export const useNotifications = () =>
  useNotificationStore((s) => s.notifications);

export const useUnreadNotificationCount = () =>
  useNotificationStore((s) => s.notifications.filter((n) => !n.read).length);

export const useNotificationActions = () =>
  useNotificationStore(
    useShallow((s) => ({
      setOpen: s.setOpen,
      fetchNotifications: s.fetchNotifications,
      markAsRead: s.markAsRead,
      markAllAsRead: s.markAllAsRead,
      remove: s.remove,
      clearAll: s.clearAll,
      pushSSENotification: s.pushSSENotification,
    }))
  );
