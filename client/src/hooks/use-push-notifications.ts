/**
 * usePushNotifications Hook
 * Manages push notification registration and subscription
 */

import { useEffect, useState, useCallback } from 'react';
import { ServiceWorkerManager } from '@/lib/service-worker-manager';
import { calendarApi } from '@/lib/api';

export interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  loading: boolean;
  error: string | null;
  vapidKey: string | null;
}

export interface UsePushNotificationsReturn extends PushNotificationState {
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  requestPermission: () => Promise<void>;
  retrySubscribe: () => Promise<void>;
}

/**
 * Hook to manage push notifications
 * Handles registration, subscription, and permission management
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: ServiceWorkerManager.isSupported(),
    isSubscribed: false,
    permission: 'default',
    loading: true,
    error: null,
    vapidKey: null,
  });

  // Initialize and check status on mount
  useEffect(() => {
    const init = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        // Check support
        const isSupported = ServiceWorkerManager.isSupported();
        if (!isSupported) {
          setState((prev) => ({
            ...prev,
            isSupported: false,
            loading: false,
          }));
          return;
        }

        // Get VAPID public key (silently skip if service unavailable)
        try {
          const response = await calendarApi.get(
            '/notifications/push/vapid-key'
          );
          const vapidKey = response.data.public_key;

          // Check subscription status
          const isSubscribed = await ServiceWorkerManager.isSubscribed();
          const permission = ServiceWorkerManager.getNotificationPermission();

          setState((prev) => ({
            ...prev,
            vapidKey,
            isSubscribed,
            permission,
            loading: false,
          }));
        } catch {
          // Service unavailable - silently disable push notifications
          setState((prev) => ({
            ...prev,
            loading: false,
          }));
        }
      } catch {
        setState((prev) => ({
          ...prev,
          error: 'Initialization failed',
          loading: false,
        }));
      }
    };

    init();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Check permission
      let permission = ServiceWorkerManager.getNotificationPermission();
      if (permission === 'default') {
        permission = await ServiceWorkerManager.requestPermission();
      }

      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get VAPID key
      if (!state.vapidKey) {
        const response = await calendarApi.get(
          '/notifications/push/vapid-key'
        );
        setState((prev) => ({ ...prev, vapidKey: response.data.public_key }));
      }

      // Subscribe to push
      const subscription = await ServiceWorkerManager.subscribe(
        state.vapidKey || ''
      );

      // Register subscription with backend
      await calendarApi.post(
        '/notifications/subscriptions/push',
        {
          subscription: subscription.toJSON(),
          browser_name: `${getBrowserName()} ${getBrowserVersion()}`,
        }
      );

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        permission: 'granted',
        loading: false,
      }));
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Subscription failed';
      setState((prev) => ({
        ...prev,
        error: errorMsg,
        loading: false,
      }));
      throw err;
    }
  }, [state.vapidKey]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Get current subscription to find ID
      const subscription = await ServiceWorkerManager.getSubscription();
      if (subscription && subscription.endpoint) {
        // Try to find the subscription in the backend and delete it
        // For now, we'll just unsubscribe locally
        await ServiceWorkerManager.unsubscribe();
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        loading: false,
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unsubscribe failed';
      setState((prev) => ({
        ...prev,
        error: errorMsg,
        loading: false,
      }));
      throw err;
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const permission = await ServiceWorkerManager.requestPermission();

      setState((prev) => ({
        ...prev,
        permission,
        loading: false,
      }));
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Permission request failed';
      setState((prev) => ({
        ...prev,
        error: errorMsg,
        loading: false,
      }));
      throw err;
    }
  }, []);

  // Retry subscription after an error
  const retrySubscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null }));
    await subscribe();
  }, [subscribe]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
    retrySubscribe,
  };
}

/**
 * Get browser name from user agent
 */
function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.indexOf('Firefox') > -1) return 'Firefox';
  if (ua.indexOf('Chrome') > -1) return 'Chrome';
  if (ua.indexOf('Safari') > -1) return 'Safari';
  if (ua.indexOf('Edge') > -1) return 'Edge';
  return 'Unknown';
}

/**
 * Get browser version from user agent
 */
function getBrowserVersion(): string {
  const ua = navigator.userAgent;
  const match = ua.match(/version\/([\d.]+)/i);
  return match ? match[1] : 'Unknown';
}

export default usePushNotifications;
