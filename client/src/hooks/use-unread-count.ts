/**
 * useUnreadCount Hook
 * Fetches and polls for unread notification count
 */

import { useEffect, useState, useCallback } from 'react';
import { calendarApiClient } from '@/lib/api/core';
import { useAuthStore } from '@/lib/store';

// Access token checks are obsolete with HttpOnly cookies

export interface UseUnreadCountReturn {
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setPollingInterval: (interval: number) => void;
}

/**
 * Hook to fetch unread notification count with polling
 * Only polls when user is authenticated
 * @param initialInterval - Polling interval in milliseconds (default: 30000ms = 30s)
 */
export function useUnreadCount(initialInterval: number = 30000): UseUnreadCountReturn {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState(initialInterval);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setError(null);

      const response = await calendarApiClient.get(
        '/notifications/unread-count'
      );

      setUnreadCount(response.data?.count || 0);
      setLoading(false);
    } catch {
      setError('Failed to load unread count');
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch on mount (only if authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      fetchUnreadCount();
    } else {
      setUnreadCount(0);
      setLoading(false);
    }
  }, [isAuthenticated, fetchUnreadCount]);

  // Set up polling (only if authenticated)
  useEffect(() => {
    if (pollingInterval <= 0 || !isAuthenticated) return;

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingInterval, isAuthenticated, fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    error,
    refetch: fetchUnreadCount,
    setPollingInterval,
  };
}

export default useUnreadCount;
