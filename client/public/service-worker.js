/**
 * Service Worker for Web Push Notifications
 * Handles push notifications in the browser
 */

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[ServiceWorker] Push received but no data');
    return;
  }

  let notificationData = {};
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: 'Notification',
      body: event.data.text(),
    };
  }

  const {
    title = 'SignApps',
    body = 'New notification',
    icon = '/icon-192.png',
    badge = '/badge-72.png',
    tag = 'notification',
    data = {},
  } = notificationData;

  const options = {
    body,
    icon,
    badge,
    tag,
    data,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/icon-open.png',
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-close.png',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error('[ServiceWorker] Error showing notification:', err);
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  const { action } = event;
  const { data, tag } = event.notification;

  event.notification.close();

  if (action === 'close') {
    return;
  }

  // Default action: navigate to notification URL
  const navigationUrl = data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Try to find existing window
        for (const client of clientList) {
          if (client.url === navigationUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not found
        if (clients.openWindow) {
          return clients.openWindow(navigationUrl);
        }
      })
  );
});

// Handle notification close (for tracking)
self.addEventListener('notificationclose', (event) => {
  const { data } = event.notification;
  // Could track that user closed the notification
  console.log('[ServiceWorker] Notification closed:', data);
});

// Handle service worker activate
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activated');
  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
      })
      .then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'SERVICE_WORKER_ACTIVATED',
          });
        });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
