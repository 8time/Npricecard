self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
  );
  if (self.registration && self.registration.unregister) {
    void self.registration.unregister();
  }
  self.clients.claim();
});

self.addEventListener('fetch', () => {
  // ネットワーク要求をそのままスルーさせる
});
