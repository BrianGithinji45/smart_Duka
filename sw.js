// Smart Duka - Service Worker - PHASE 15 - Offline First
const CACHE_NAME = 'smart-duka-v1';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/products.js',
  './js/sales.js',
  './js/debts.js',
  './js/loans.js',
  './js/expenses.js',
  './js/reports.js',
  './js/backup.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (res) {
        // Cache new files for next offline use, but don't cache IndexedDB / API
        if (e.request.url.startsWith('http') && e.request.method === 'GET') {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, resClone); });
        }
        return res;
      }).catch(function () {
        // Offline and not cached - return index
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});