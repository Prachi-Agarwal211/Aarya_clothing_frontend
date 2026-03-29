/**
 * Service Worker for Aarya Clothing
 *
 * Caching Strategies:
 * - Cache-first for static assets (images, fonts, CSS, JS)
 * - Network-only for API requests (NEVER cache API)
 * - Stale-while-revalidate for HTML pages
 */

const CACHE_VERSION = 'v5';
const CACHE_NAME = `aarya-clothing-${CACHE_VERSION}-CLEAN`;
const STATIC_CACHE = `aarya-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `aarya-images-${CACHE_VERSION}`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/offline',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches aggressively
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          // Delete if:
          // 1. Not current static/image cache
          // 2. Is old aarya-clothing cache (v1, v2, etc)
          // 3. Contains "NO-API-CACHE" but is not current version
          const isCurrentStatic = name === STATIC_CACHE;
          const isCurrentImage = name === IMAGE_CACHE;
          const isOldAaryaCache = name.startsWith('aarya-clothing-') || 
                                  name.startsWith('aarya-static-') || 
                                  name.startsWith('aarya-images-');
          
          if (!isCurrentStatic && !isCurrentImage && isOldAaryaCache) {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          }
          return null;
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Image caching strategy - Cache first, then network
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached image, but also fetch in background
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
            }).catch(() => {
              // Network failed, cached version already returned
            });
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Offline fallback for images
            return new Response('', { status: 404 });
          });
        });
      })
    );
    return;
  }

  // Static assets (CSS, JS, fonts) - Cache first
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = caches.open(STATIC_CACHE);
            cache.then((c) => c.put(request, networkResponse.clone()));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // API requests - Network only (NEVER cache API responses)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return offline error for API requests when offline
        return new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // HTML pages - Stale while revalidate
  if (request.destination === 'document') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = caches.open(STATIC_CACHE);
            cache.then((c) => c.put(request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => {
          // Return offline page if both cache and network fail
          return caches.match('/offline');
        });
        
        // Return cached version immediately, update in background
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default - Network first
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        caches.delete(cacheName);
      });
    });
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  }
});

async function syncCart() {
  // Sync cart data when back online
  // This will be implemented with the cart context
}

// Push notifications for order updates
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'New update from Aarya Clothing',
    icon: '/logo.png',
    badge: '/badge.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/profile/orders',
    },
    actions: [
      {
        action: 'view',
        title: 'View',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Aarya Clothing', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
