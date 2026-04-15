/**
 * useNotificationHistory Hook
 * Fetches and manages notification history
 */

import { useEffect, useState, useCallback } from "react";
import { calendarApiClient } from "@/lib/api/core";

export interface Notification {
  id: string;
  user_id: string;
  event_id?: string;
  task_id?: string;
  type: string; // email, push, sms
  channel: string; // event_reminder, task_due, attendee_response, etc.
  title?: string;
  message?: string;
  sent_at: string;
  read_at?: string;
  delivery_status?: string; // sent, pending, failed
}

export interface UseNotificationHistoryReturn {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  resendNotification: (notificationId: string) => Promise<void>;
}

/**
 * Hook to fetch notification history
 */
export function useNotificationHistory(
  limit: number = 50,
): UseNotificationHistoryReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await calendarApiClient.get(
        `/notifications/history?limit=${limit}`,
      );

      setNotifications(response.data || []);
    } catch {
      setError("Failed to load notification history");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Resend a notification
  const resendNotification = useCallback(
    async (notificationId: string) => {
      try {
        setError(null);

        await calendarApiClient.post(
          `/notifications/${notificationId}/resend`,
          {},
        );

        // Refresh the list
        await fetchNotifications();
      } catch (err) {
        setError("Failed to resend notification");
        throw err;
      }
    },
    [fetchNotifications],
  );

  return {
    notifications,
    loading,
    error,
    refetch: fetchNotifications,
    resendNotification,
  };
}

export default useNotificationHistory;
