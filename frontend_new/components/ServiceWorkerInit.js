'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerInit — registers the service worker for static asset caching.
 *
 * Must be a 'use client' component because service worker APIs
 * only exist in the browser. layout.js is a Server Component so
 * inline scripts with `typeof window` checks never execute.
 */
export default function ServiceWorkerInit() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return null;
}
