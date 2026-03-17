/**
 * Web Vitals Performance Monitoring
 * 
 * Tracks Core Web Vitals metrics:
 * - LCP (Largest Contentful Paint) - Target: < 2.5s
 * - FID (First Input Delay) - Target: < 100ms
 * - CLS (Cumulative Layout Shift) - Target: < 0.1
 * - INP (Interaction to Next Paint) - Target: < 200ms
 * - TTFB (Time to First Byte) - Target: < 800ms
 * - FCP (First Contentful Paint) - Target: < 1.8s
 */

import { onLCP, onFID, onCLS, onINP, onTTFB, onFCP } from 'web-vitals';

// Analytics function - send to your analytics endpoint
function sendToAnalytics(metric) {
  const body = {
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating, // 'good', 'needs-improvement', 'poor'
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    });
  }

  // Send to analytics endpoint in production
  if (process.env.NODE_ENV === 'production') {
    // Use sendBeacon for reliable delivery even when page is closing
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
      navigator.sendBeacon('/api/vitals', blob);
    } else {
      // Fallback to fetch
      fetch('/api/vitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(err => {
        console.error('[Web Vitals] Failed to send metrics:', err);
      });
    }
  }
}

/**
 * Initialize Web Vitals monitoring
 * Call this once in your root layout or _app.js
 */
export function initWebVitals() {
  // Largest Contentful Paint - measures loading performance
  onLCP((metric) => {
    sendToAnalytics(metric);
    
    // Log warnings for poor LCP
    if (metric.rating === 'poor') {
      console.warn('[Performance] Poor LCP detected:', metric.value.toFixed(2), 'ms');
    }
  });

  // First Input Delay - measures interactivity
  onFID((metric) => {
    sendToAnalytics(metric);
    
    if (metric.rating === 'poor') {
      console.warn('[Performance] Poor FID detected:', metric.value.toFixed(2), 'ms');
    }
  });

  // Cumulative Layout Shift - measures visual stability
  onCLS((metric) => {
    sendToAnalytics(metric);
    
    if (metric.rating === 'poor') {
      console.warn('[Performance] Poor CLS detected:', metric.value.toFixed(4));
    }
  });

  // Interaction to Next Paint - measures responsiveness
  onINP((metric) => {
    sendToAnalytics(metric);
    
    if (metric.rating === 'poor') {
      console.warn('[Performance] Poor INP detected:', metric.value.toFixed(2), 'ms');
    }
  });

  // Time to First Byte - measures server response time
  onTTFB((metric) => {
    sendToAnalytics(metric);
    
    if (metric.rating === 'poor') {
      console.warn('[Performance] Poor TTFB detected:', metric.value.toFixed(2), 'ms');
    }
  });

  // First Contentful Paint - measures initial render
  onFCP((metric) => {
    sendToAnalytics(metric);
    
    if (metric.rating === 'poor') {
      console.warn('[Performance] Poor FCP detected:', metric.value.toFixed(2), 'ms');
    }
  });
}

/**
 * Custom performance observer for additional metrics
 */
export function observePerformance() {
  if (typeof window === 'undefined' || !PerformanceObserver) return;

  // Observe long tasks (tasks > 50ms that block the main thread)
  try {
    const longTaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        console.log('[Performance] Long task detected:', {
          duration: entry.duration.toFixed(2) + 'ms',
          name: entry.name,
        });
      });
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    // longtask not supported
  }

  // Observe layout shifts for debugging CLS
  try {
    const layoutShiftObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          console.log('[Performance] Layout shift:', {
            value: entry.value.toFixed(4),
            sources: entry.sources?.length || 0,
          });
        }
      });
    });
    layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
  } catch (e) {
    // layout-shift not supported
  }

  // Observe paint timing
  try {
    const paintObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        console.log('[Performance] Paint event:', {
          name: entry.name,
          startTime: entry.startTime.toFixed(2) + 'ms',
        });
      });
    });
    paintObserver.observe({ entryTypes: ['paint'] });
  } catch (e) {
    // paint not supported
  }
}

/**
 * Get current performance metrics
 * @returns {Object} Current performance metrics
 */
export function getPerformanceMetrics() {
  if (typeof window === 'undefined' || !performance.getEntriesByType) {
    return null;
  }

  const navigation = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');

  return {
    ttfb: navigation?.responseStart || 0,
    domContentLoaded: navigation?.domContentLoadedEventEnd || 0,
    loaded: navigation?.loadEventEnd || 0,
    fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
    fp: paint.find(p => p.name === 'first-paint')?.startTime || 0,
  };
}
