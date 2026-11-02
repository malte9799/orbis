// Orbis service worker: offline app shell + runtime caching of same-origin static files.
// Live data (Wetter, Radar, Flugzeuge, Kartenkacheln …) is cross-origin and always goes to the network.
const VERSION = 'orbis-v2';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(['./', './favicon.svg', './manifest.webmanifest', './icon-192.png'])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: network first, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      // no-cache: ignore GitHub Pages' 10-min HTTP cache so a fresh deploy shows up on the next launch.
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  // Static files (hashed bundles, textures, models, data): cache first, fill on demand.
  if (req.headers.has('range')) return;
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.status === 200) {
            const copy = res.clone();
            caches.open(STATIC).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// Web Push (Fahrplan: saved commuter trips, see proxy/fahrplan-push-worker.js). The worker sends an
// encrypted JSON { title, body, tag, url }; it arrives here even while the app is closed.
self.addEventListener('push', (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || 'Orbis Fahrplan', {
      body: msg.body || '',
      tag: msg.tag || 'fahrplan',
      renotify: true,
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { url: msg.url || './#/fahrplan' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './#/fahrplan', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
          return c.focus().then(() => ('navigate' in c ? c.navigate(target) : undefined));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
