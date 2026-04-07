/**
 * Service Worker for Aarya Clothing
 *
 * Cache Strategy:
 * - HTML / navigation:    NETWORK-ONLY  — must always get fresh HTML with new chunk hashes after rebuild
 * - /_next/static/:       CACHE-FIRST   — content-hashed filenames, safe to cache forever
 * - /_next/image:         NETWORK-FIRST — short-lived cache
 * - /public static files: NETWORK-FIRST — logo, fonts, manifest
 * - API requests:         NETWORK-ONLY  — never cache auth/cart/order state
 * - Cross-origin:         BYPASS        — R2 CDN, Razorpay etc. handled by browser
 *
 * WHY HTML IS NEVER CACHED:
 *   After a Docker rebuild, Next.js generates new JS chunk filenames (content hashes change).
 *   If the browser serves OLD cached HTML, it references OLD chunk URLs → 404 → broken page.
 *   This is the "works in incognito, broken in normal browser" bug.
 *   Fix: HTML is always fetched from network. Never put into service worker cache.
 *
 * Version string: changes on every rebuild to invalidate old static caches.
 */

// Auto-increment version: ISO date ensures new caches on each calendar-day deploy
// For more granular invalidation, inject __SW_VERSION__ at build time
const SW_VERSION = typeof __SW_VERSION__ !== 'undefined'
  ? __SW_VERSION__
  : new Date().toISOString().slice(0, 13).replace('T', '-'); // e.g. "2026-04-07-19"

const STATIC_CACHE = `aarya-static-${SW_VERSION}`;
const IMAGE_CACHE  = `aarya-images-${SW_VERSION}`;

const CURRENT_CACHES = [STATIC_CACHE, IMAGE_CACHE];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
  console.log(`[SW] v${SW_VERSION} installed`);
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !CURRENT_CACHES.includes(name))
            .map((name) => {
              console.log(`[SW] Deleting stale cache: ${name}`);
              return caches.delete(name);
            })
        )
      )
      .then(() => {
        console.log(`[SW] v${SW_VERSION} activated`);
        return self.clients.claim();
      })
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only intercept same-origin GET requests
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);

  // 1. API — NETWORK ONLY: never cache auth/cart/order state
  if (url.pathname.startsWith('/api/')) return;

  // 2. Next.js static chunks — CACHE FIRST (content-hashed, safe forever)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 3. Next.js image optimizer — NETWORK FIRST with image cache
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(networkFirst(request, IMAGE_CACHE));
    return;
  }

  // 4. Public static files (logo, fonts, manifest) — NETWORK FIRST
  if (
    url.pathname.startsWith('/fonts/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/logo.png' ||
    url.pathname === '/noise.png'
  ) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // 5. HTML / navigation — NETWORK ONLY (CRITICAL: never cache HTML)
  //    Old cached HTML → old chunk URLs → 404 → broken page in returning users
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  ) {
    event.respondWith(networkOnlyHtml(request));
    return;
  }

  // 6. Everything else — pass through (network only)
});

// ─── Strategies ──────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('', { status: 503 });
  }
}

async function networkOnlyHtml(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aarya Clothing — Offline</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
min-height:100vh;margin:0;background:#0B0608;color:#EAE0D5;text-align:center}
h1{color:#F2C29A}a{color:#B76E79}</style></head>
<body><div><h1>You're offline</h1>
<p>Please check your connection and <a href="/">try again</a>.</p></div></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ─── Messages ────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
    );
  }
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Aarya Clothing', {
      body: data.body || 'New notification',
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});

console.log(`[SW] Aarya Clothing v${SW_VERSION} loaded`);
