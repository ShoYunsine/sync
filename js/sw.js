const CACHE_NAME = 'logbook-cache-v1';
const BASE_PATH = location.hostname === 'localhost' ? '' : '/dtr';

const ASSETS_TO_CACHE = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/classes.html`,
  `${BASE_PATH}/class.html`,
  `${BASE_PATH}/css`,
  `${BASE_PATH}/js`,
  `${BASE_PATH}/Images`,
  `${BASE_PATH}/fonts/Billabong.ttf`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/models`
];

// Install: Cache essential assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching essential assets...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(err => console.error('[Service Worker] Cache error:', err))
  );
  self.skipWaiting(); // Activate new SW immediately
});

// Activate: Clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first with cache fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(response => {
      const responseClone = response.clone();
      console.log('[Service Worker] Fetching...');
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
      return response;
    }).catch(() => caches.match(event.request).then(cacheResponse =>
      cacheResponse || caches.match(`${BASE_PATH}/index.html`) // Offline fallback
    ))
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Notification', body: 'No content' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.warn('Push payload is not JSON, using text:', e);
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/Images/logo.png',
    })
  );
});


self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification);

  event.notification.close();

  event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
          for (const client of clientList) {
              if (client.url === event.notification.data.url && 'focus' in client) {
                  return client.focus();
              }
          }
          if (clients.openWindow) {
              return clients.openWindow(event.notification.data.url);
          }
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
      const { title, body, url } = event.data;

      self.registration.showNotification(title, {
          body: body,
          icon: '/Images/logo.png',
          badge: '/Images/logo.png',
          data: { url: url || '/' },
      });
  }
});
