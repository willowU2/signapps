/**
 * Push Manager — V2-13: Push Notifications & Offline Sync foundation
 *
 * Pure utilities for managing Web Push subscriptions. React-free; can be
 * called from hooks or server actions.
 */

import { VAPID_PUBLIC_KEY } from "@/lib/api/core";

const PUSH_SUBSCRIPTION_ENDPOINT = "/api/v1/notifications/subscriptions/push";

/**
 * Convert a URL-safe base64 VAPID public key to the Uint8Array expected by
 * the Web Push API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/**
 * Ask the browser for push-notification permission.
 * Returns the resulting permission state ('granted' | 'denied' | 'default').
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("Notifications are not supported in this environment");
  }
  return Notification.requestPermission();
}

/**
 * Create a PushSubscription for the given user and register it with the
 * backend calendar service.
 *
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY to be set; if absent the subscription
 * is created without an applicationServerKey (development fallback).
 *
 * @param userId  — The authenticated user's ID (sent to the backend).
 * @returns The resulting PushSubscription object.
 */
export async function subscribeToPush(
  userId: string,
): Promise<PushSubscription> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported in this browser");
  }

  const permission = await requestPushPermission();
  if (permission !== "granted") {
    throw new Error("Push permission denied by the user");
  }

  // Reuse the already-registered SW (registered by register-sw.ts on app mount)
  const registration = await navigator.serviceWorker.ready;

  const vapidKey = VAPID_PUBLIC_KEY || undefined;
  const subscribeOptions: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
  };
  if (vapidKey) {
    // Cast through ArrayBuffer to satisfy the strict PushSubscriptionOptionsInit
    // typing that requires ArrayBufferView<ArrayBuffer>, not Uint8Array<ArrayBufferLike>.
    subscribeOptions.applicationServerKey = urlBase64ToUint8Array(vapidKey)
      .buffer as ArrayBuffer;
  }

  const subscription =
    await registration.pushManager.subscribe(subscribeOptions);

  // Detect browser name for the backend record
  const ua = navigator.userAgent;
  let browserName = "Unknown";
  if (ua.includes("Edg")) browserName = "Edge";
  else if (ua.includes("Chrome")) browserName = "Chrome";
  else if (ua.includes("Firefox")) browserName = "Firefox";
  else if (ua.includes("Safari")) browserName = "Safari";

  // Persist the subscription in the calendar service
  await fetch(PUSH_SUBSCRIPTION_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      subscription: subscription.toJSON(),
      browser_name: browserName,
    }),
  });

  return subscription;
}

/**
 * Unsubscribe from push notifications and remove the subscription from the
 * backend.
 *
 * @returns `true` if the browser subscription was successfully removed.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  // Remove from backend first so it doesn't linger if browser call fails
  await fetch(PUSH_SUBSCRIPTION_ENDPOINT, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {
    // Non-fatal: log and continue with browser-side removal
    console.warn("[PushManager] Failed to remove subscription from backend");
  });

  return subscription.unsubscribe();
}
