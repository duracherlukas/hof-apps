// Service Worker: App offline starten + angesehene Kartenteile merken. Nach Updates Version erhöhen.
const CACHE = 'wandertagebuch-v1';
const TILES = 'wandertagebuch-tiles-v1';
const MAX_TILES = 2500;
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const TILE_HOSTS = /(^|\.)tile\.opentopomap\.org$|^mapsneu\.wien\.gv\.at$/;

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== TILES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
async function trim() { const c = await caches.open(TILES); const k = await c.keys(); if (k.length > MAX_TILES) await Promise.all(k.slice(0, k.length - MAX_TILES).map((x) => c.delete(x))); }
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (TILE_HOSTS.test(url.hostname)) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); if (Math.random() < 0.02) trim(); }
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
