self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification('Aahvaanam Home Food', {
    body: data.body || 'A new order needs your attention.',
    icon: '/images/aahvaanam-correct-icon.webp',
    badge: '/images/aahvaanam-correct-icon.webp',
    tag: data.tag || 'new-order',
    data: { url: '/admin' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(c => new URL(c.url).pathname.startsWith('/admin'));
    if (existing) return existing.focus();
    return clients.openWindow('/admin');
  }));
});
