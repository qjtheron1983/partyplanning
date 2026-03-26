// BASH PWA Service Worker v2.0
const CACHE = 'bash-v2';

// Only cache things we know exist locally
const PRECACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json'
];

// ── Install: cache only local files ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(e => console.log('[SW] Skipping:', url, e.message))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: smart routing ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;
  // Skip chrome extensions
  if (url.protocol === 'chrome-extension:') return;
  // Skip Firebase, Google APIs, Spotify, Tenor — always network
  const passThrough = [
    'firebaseio.com', 'googleapis.com', 'firebase.com',
    'gstatic.com', 'accounts.spotify.com', 'api.spotify.com',
    'tenor.com', 'fonts.googleapis.com'
  ];
  if (passThrough.some(h => url.hostname.includes(h))) return;

  // For local app files: cache-first with network fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          // Cache successful HTML/JS/CSS responses
          if (response.ok && ['document','script','style','image','font'].includes(request.destination)) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return response;
        }).catch(() => {
          // Offline fallback for navigation
          if (request.destination === 'document') {
            return caches.match('/offline.html');
          }
        });
      })
    );
    return;
  }

  // CDN assets (fonts, FA icons): cache-first
  if (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
  }
});

// ── Push notifications ──
self.addEventListener('push', event => {
  let data = { title: '🎉 BASH', body: 'New party activity!', icon: '/icons/icon-192.png' };
  try { data = { ...data, ...event.data.json() }; } catch(e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/icons/icon-72.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(cls => {
      for (const c of cls) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});
