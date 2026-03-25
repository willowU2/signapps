/// <reference lib="webworker" />
// AQ-OFFLN: Offline-first service worker with background sync
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  BackgroundSyncPlugin,
  CacheFirst,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
  ExpirationPlugin,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Background sync queue for offline mutations (POST/PUT/PATCH/DELETE)
const bgSyncPlugin = new BackgroundSyncPlugin("offline-mutations", {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours (in minutes)
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // AQ-OFFLN: Mutation requests use NetworkOnly + BackgroundSync so they
    // are replayed automatically when connectivity is restored.
    {
      matcher: ({ request, url }) =>
        url.pathname.startsWith("/api/") &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(request.method),
      handler: new NetworkFirst({
        cacheName: "api-mutations",
        plugins: [
          bgSyncPlugin,
          new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
        ],
        networkTimeoutSeconds: 10,
      }),
    },
    // API reads: network-first with cache fallback
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "api-cache",
        plugins: [
          new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 5 * 60 }),
        ],
      }),
    },
    // Static assets: cache-first
    {
      matcher: ({ request }) =>
        request.destination === "image" ||
        request.destination === "font" ||
        request.destination === "style",
      handler: new CacheFirst({
        cacheName: "static-assets",
        plugins: [
          new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },
    // JS/WASM: stale-while-revalidate
    {
      matcher: ({ request }) =>
        request.destination === "script" || request.destination === "worker",
      handler: new StaleWhileRevalidate({
        cacheName: "js-cache",
        plugins: [
          new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 }),
        ],
      }),
    },
    // Keep Serwist defaults as fallback
    ...defaultCache,
  ],
});

// Push notification handling
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const notification = {
    title: data.title || "SignApps",
    body: data.body || "You have a new notification",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: { url: data.link || "/" },
  };

  event.waitUntil(
    self.registration.showNotification(notification.title, notification)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

serwist.addEventListeners();
