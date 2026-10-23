// Service Worker: hält die App-Dateien offline verfügbar.
// Nach einem Update der App-Dateien die Versionsnummer erhöhen.
const CACHE = 'kalorien-v2';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'foods.js', 'manifest.webmanifest', 'vendor/zxing.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Eigene Dateien: zuerst Netzwerk (damit Updates sofort ankommen), offline aus dem Cache.
// Fremde Anfragen (KI, Open Food Facts) werden nicht angefasst.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
