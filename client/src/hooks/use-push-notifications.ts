'use client';

import { useState, useCallback } from 'react';
import { calendarApi } from '@/lib/api';

export function usePushNotifications() {
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if already registered
  const checkRegistration = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      setRegistered(!!registration);
      return !!registration;
    }
    return false;
  }, []);

  // Register service worker and subscribe to push
  const register = async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers not supported in this browser');
    }

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Check if we need a VAPID key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn('No VAPID public key configured. Push might not work properly.');
      }

      // Subscribe to push (optional vapid key handling for dev)
      const options = { userVisibleOnly: true, ...(vapidKey && { applicationServerKey: vapidKey }) };
      const subscription = await registration.pushManager.subscribe(options);

      // Extract browser name
      const ua = navigator.userAgent;
      let browser_name = 'Unknown';
      if (ua.includes('Chrome')) browser_name = 'Chrome';
      else if (ua.includes('Firefox')) browser_name = 'Firefox';
      else if (ua.includes('Safari')) browser_name = 'Safari';
      else if (ua.includes('Edge')) browser_name = 'Edge';

      // Send to backend
      await calendarApi.post('/notifications/subscriptions/push', {
        subscription,
        browser_name,
      });

      setRegistered(true);
      return true;
    } catch (error) {
      console.warn('Failed to register push:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { register, registered, checkRegistration, loading };
}
