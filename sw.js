// BASH PWA Service Worker v6.0
const CACHE = 'bash-v6';

const PRECACHE = [
  './index.html',
  './offline.html',
  './manifest.json'
];

// ── Install ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(e => console.log('[SW] Skip:', url, e.message))
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

// ── Fetch ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Always go network for Firebase, Spotify, Tenor, Google APIs
  const passThrough = [
    'firebaseio.com', 'googleapis.com', 'firebase.com',
    'gstatic.com', 'accounts.spotify.com', 'api.spotify.com',
    'tenor.com', 'fonts.googleapis.com', 'firebaseapp.com',
    'firebasestorage.app'
  ];
  if (passThrough.some(h => url.hostname.includes(h))) return;

  // Local app files: cache-first with network fallback
  if (url.hostname === 'qjtheron1983.github.io') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return response;
        }).catch(() => {
          if (request.destination === 'document') {
            return caches.match('./index.html') || caches.match('./offline.html');
          }
        });
      })
    );
    return;
  }

  // CDN assets: cache-first
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
  let data = { title: '🎉 BASH', body: 'New party activity!', icon: '/partyplanning/icons/icon-192.png' };
  try { data = { ...data, ...event.data.json() }; } catch(e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/partyplanning/icons/icon-72.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});
