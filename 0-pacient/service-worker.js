// Простой кэш «всё для офлайна». При обновлении версии игры меняем CACHE_NAME —
// это заставит сервис-воркер перекачать файлы заново.
const CACHE_NAME = 'tq-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/story.js',
  './js/audio.js',
  './js/fx.js',
  './js/engine.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/images/metro.jpg',
  './assets/images/tunnel.jpg',
  './assets/images/city.jpg',
  './assets/images/hospital.jpg',
  './assets/images/danger.jpg',
  './assets/images/university.jpg',
  './assets/images/warehouse.jpg',
  './assets/images/radio.jpg',
  './assets/images/camp.jpg',
  './assets/images/dome.jpg',
  './assets/images/dome_in.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Сначала кэш (быстро и офлайн), сеть — для обновления кэша в фоне.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
