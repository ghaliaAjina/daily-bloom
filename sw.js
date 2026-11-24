const CACHE_NAME = 'daily-bloom-shell-v2-0-2';
const SHELL_ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icon.svg',
  './apple-touch-icon.png', './js/app.js', './js/database.js',
  './js/date-utils.js', './js/catalog.js', './js/task-service.js',
  './js/habit-service.js', './js/fitness-service.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate';
  event.respondWith((async () => {
    if (isNavigation) {
      try {
        const networkResponse = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', networkResponse.clone());
        return networkResponse;
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    }

    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch {
      return (await caches.match(event.request)) || Response.error();
    }
  })());
});
