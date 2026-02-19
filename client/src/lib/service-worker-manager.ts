/**
 * Service Worker Manager
 * Handles Service Worker registration and push subscription management
 */

/**
 * Convert base64 VAPID public key to Uint8Array for Web Push API
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Service Worker Manager
 * Provides utilities for Service Worker registration and push notification subscription
 */
export class ServiceWorkerManager {
  /**
   * Check if Service Workers are supported
   */
  static isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Register Service Worker
   */
  static async register(): Promise<ServiceWorkerRegistration> {
    if (!ServiceWorkerManager.isSupported()) {
      throw new Error('Service Workers not supported in this browser');
    }

    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });
    return registration;
  }

  /**
   * Get current push subscription
   */
  static async getSubscription(): Promise<PushSubscription | null> {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return null;
      return registration.pushManager.getSubscription();
    } catch {
      return null;
    }
  }

  /**
   * Subscribe to push notifications
   */
  static async subscribe(vapidPublicKey: string): Promise<PushSubscription> {
    const registration = await this.register();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    return subscription;
  }

  /**
   * Unsubscribe from push notifications
   */
  static async unsubscribe(): Promise<boolean> {
    const subscription = await this.getSubscription();
    if (!subscription) return false;
    return subscription.unsubscribe();
  }

  /**
   * Check notification permission status
   */
  static getNotificationPermission(): NotificationPermission {
    return Notification.permission;
  }

  /**
   * Request notification permission
   */
  static async requestPermission(): Promise<NotificationPermission> {
    if (!ServiceWorkerManager.isSupported()) {
      throw new Error('Notifications not supported');
    }
    return Notification.requestPermission();
  }

  /**
   * Check if currently subscribed
   */
  static async isSubscribed(): Promise<boolean> {
    const subscription = await this.getSubscription();
    return subscription !== null;
  }
}

export default ServiceWorkerManager;
