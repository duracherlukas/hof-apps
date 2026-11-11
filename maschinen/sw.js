// Service Worker: App offline verfügbar machen.
// Nach einem Update der App-Dateien die Versionsnummer erhöhen (v2, v3 …).
const CACHE = 'hof-maschinen-v5';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'store.js', 'config.js', 'manifest.webmanifest', 'vendor/qrcode.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'hof-maschinen-due').map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase-Bibliotheken: ändern sich nie (feste Version) → aus dem Cache, damit die App offline startet.
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Eigene Dateien: zuerst Netz (Updates kommen sofort an), offline aus dem Cache.
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});

// Erinnerungen im Hintergrund (Android, installierte App): fällige Dinge aus dem letzten App-Start melden
async function checkDue() {
  const c = await caches.open('hof-maschinen-due');
  const r = await c.match('due.json');
  if (!r) return;
  const d = await r.json();
  if (!d.on || !d.items || !d.items.length) return;
  const today = new Date().toISOString().slice(0, 10);
  const last = await c.match('last.txt');
  if (last && (await last.text()) === today) return;
  await self.registration.showNotification(`Hof-Maschinen: ${d.items.length} ${d.items.length === 1 ? 'Sache' : 'Sachen'} fällig`, {
    body: d.items.slice(0, 4).map((i) => `${i.name}: ${i.label}`).join('\n'), icon: 'icons/icon-192.png', tag: 'due' });
  await c.put('last.txt', new Response(today));
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'due-check') e.waitUntil(checkDue()); });
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((ws) => (ws.length ? ws[0].focus() : self.clients.openWindow('./'))));
});
