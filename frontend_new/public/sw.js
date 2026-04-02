/**
 * Service Worker for Aarya Clothing
 * 
 * Features:
 * - Offline support with cached assets
 * - Stale-while-revalidate for images
 * - Cache-first for static assets
 * - Network-first for API requests
 * - Pre-caching for critical resources
 * 
 * Performance Goals:
 * - Instant page loads for cached content
 * - Reduced bandwidth usage
 * - Offline browsing capability
 */

const CACHE_NAME = 'aarya-clothing-v1';
const STATIC_CACHE = 'aarya-static-v1';
const IMAGE_CACHE = 'aarya-images-v1';
const API_CACHE = 'aarya-api-v1';

// Critical resources to cache immediately
const CRITICAL_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
];

// Static assets patterns
const STATIC_PATTERNS = [
  '/_next/static/**',
  '/_next/image/**',
  '/fonts/**',
];

// Image patterns (R2 CDN) - EXCLUDED from SW caching due to CSP
// R2 images are already CDN-cached and load directly with CSP img-src 'self' https:
const IMAGE_PATTERNS = [
  // R2 CDN excluded - let browser handle these directly
  // 'https://pub-*.r2.dev/**',
  // 'https://*.r2.cloudflarestorage.com/**',
];

// API patterns
const API_PATTERNS = [
  '/api/**',
  'http://localhost:6005/**',
  'http://backend:6005/**',
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching critical assets');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service worker installed');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[SW] Cache failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  const currentCaches = [CACHE_NAME, STATIC_CACHE, IMAGE_CACHE, API_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim(); // Take control of all clients immediately
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!requestUrl.protocol.startsWith('http')) {
    return;
  }

  // Skip R2 CDN images - let browser handle them directly (CSP compliant)
  if (requestUrl.hostname.includes('pub-7846c786f7154610b57735df47899fa0.r2.dev') ||
      requestUrl.hostname.includes('r2.cloudflarestorage.com')) {
    return; // Don't intercept R2 images
  }

  // Determine cache strategy based on request type
  if (isImageRequest(request)) {
    // Images: Stale-while-revalidate
    event.respondWith(handleImageRequest(request));
  } else if (isStaticRequest(request)) {
    // Static assets: Cache-first
    event.respondWith(handleStaticRequest(request));
  } else if (isApiRequest(request)) {
    // API: Network-first with cache fallback
    event.respondWith(handleApiRequest(request));
  } else {
    // HTML/pages: Network-first with cache fallback
    event.respondWith(handlePageRequest(request));
  }
});

// Image request handler (stale-while-revalidate)
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  
  try {
    // Try cache first
    const cachedResponse = await cache.match(request);
    
    // Fetch from network in background
    const networkFetch = fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => null);
    
    // Return cached response immediately, update cache in background
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // No cache, wait for network
    const networkResponse = await networkFetch;
    if (networkResponse) {
      return networkResponse;
    }
    
    // Fallback to placeholder
    return await caches.match('/placeholder-image.jpg');
  } catch (error) {
    console.error('[SW] Image fetch failed:', error);
    return await caches.match('/placeholder-image.jpg');
  }
}

// Static asset request handler (cache-first)
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  try {
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Static fetch failed:', error);
    return new Response('Resource not available', { status: 404 });
  }
}

// API request handler (network-first with cache fallback)
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] API fetch failed, trying cache...');
    
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Page request handler (network-first with cache fallback)
async function handlePageRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Page fetch failed, trying cache...');
    
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page
    return await caches.match('/offline');
  }
}

// Helper functions
function isImageRequest(request) {
  const url = request.url;
  const acceptHeader = request.headers.get('accept') || '';
  
  return (
    url.includes('pub-') && url.includes('r2.dev') ||
    url.includes('r2.cloudflarestorage.com') ||
    acceptHeader.includes('image/') ||
    /\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/i.test(url)
  );
}

function isStaticRequest(request) {
  const url = request.url;
  
  return (
    url.includes('/_next/static/') ||
    url.includes('/_next/image/') ||
    url.includes('/fonts/') ||
    url.endsWith('.js') ||
    url.endsWith('.css') ||
    url.endsWith('.woff') ||
    url.endsWith('.woff2')
  );
}

function isApiRequest(request) {
  const url = request.url;
  
  return (
    url.includes('/api/') ||
    url.includes('localhost:6005') ||
    url.includes('backend:6005')
  );
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-cart' || event.tag === 'sync-wishlist') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  // Get pending actions from IndexedDB
  // This would be implemented with the main app
  console.log('[SW] Syncing offline actions...');
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'New notification from Aarya Clothing',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Aarya Clothing', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      })
    );
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

console.log('[SW] Service worker loaded');
