
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "DuoNexus ❤️";
  const options = {
    body: data.body || "You have a new message!",
    icon: data.icon || '/icon-192.png',
    badge: '/badge-72.png',
    image: data.image || null,
    tag: data.tag || 'duonexus-msg',
    renotify: true,
    data: data.data || {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url || self.location.origin;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
