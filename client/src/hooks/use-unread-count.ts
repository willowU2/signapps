/**
 * useUnreadCount Hook
 * Fetches and polls for unread notification count
 */

import { useEffect, useState, useCallback } from 'react';
import { calendarApi } from '@/lib/api';

export interface UseUnreadCountReturn {
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setPollingInterval: (interval: number) => void;
}

/**
 * Hook to fetch unread notification count with polling
 * @param initialInterval - Polling interval in milliseconds (default: 30000ms = 30s)
 */
export function useUnreadCount(initialInterval: number = 30000): UseUnreadCountReturn {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState(initialInterval);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      setError(null);

      const response = await calendarApi.get(
        '/notifications/unread-count'
      );

      setUnreadCount(response.data?.count || 0);
      setLoading(false);
    } catch {
      setError('Failed to load unread count');
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Set up polling
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingInterval, fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    error,
    refetch: fetchUnreadCount,
    setPollingInterval,
  };
}

export default useUnreadCount;
