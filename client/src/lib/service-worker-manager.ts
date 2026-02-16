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

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw new Error(`Service Worker registration failed: ${error}`);
    }
  }

  /**
   * Get current push subscription
   */
  static async getSubscription(): Promise<PushSubscription | null> {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return null;
      return registration.pushManager.getSubscription();
    } catch (error) {
      console.error('Failed to get push subscription:', error);
      return null;
    }
  }

  /**
   * Subscribe to push notifications
   */
  static async subscribe(vapidPublicKey: string): Promise<PushSubscription> {
    try {
      const registration = await this.register();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      console.log('Push subscription created:', subscription);
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw new Error(`Push subscription failed: ${error}`);
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  static async unsubscribe(): Promise<boolean> {
    try {
      const subscription = await this.getSubscription();
      if (!subscription) return false;

      const unsubscribed = await subscription.unsubscribe();
      console.log('Push unsubscription successful:', unsubscribed);
      return unsubscribed;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw new Error(`Unsubscribe failed: ${error}`);
    }
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

    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      throw new Error(`Permission request failed: ${error}`);
    }
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
