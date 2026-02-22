self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const notification = {
    title: data.title || 'SignApps',
    body: data.body || 'You have a new notification',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    click_action: data.link || '/',
  };

  event.waitUntil(
    self.registration.showNotification(notification.title, notification)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.click_action && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.click_action);
    })
  );
});
