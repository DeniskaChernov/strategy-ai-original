// Strategy AI — Service Worker (PWA)
// v9: network-first for all JS bundles (app.js + code-split chunks)
const CACHE = 'strategy-ai-v10';

function isApiOrSocket(u) {
  return u.href.includes('/api/') || u.pathname.includes('socket');
}

function isNetworkFirstAsset(url) {
  const p = url.pathname;
  return (
    p === '/app.js' ||
    p.startsWith('/chunk-') ||
    p === '/' ||
    p === '/index.html' ||
    p === '/env-config.js' ||
    p === '/global.css' ||
    p === '/landing.css' ||
    p === '/strategy-shell.css' ||
    p === '/tailwind.css'
  );
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          '/logo.png',
          '/icon.svg',
          '/icon-maskable.svg',
          '/manifest.json',
        ])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (isApiOrSocket(url)) return;

  if (isNetworkFirstAsset(url)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((r) => {
          if (r.ok && r.type === 'basic') {
            const clone = r.clone();
            caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((r) => {
          if (r.ok && r.type === 'basic') {
            const clone = r.clone();
            caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          }
          return r;
        })
    )
  );
});
