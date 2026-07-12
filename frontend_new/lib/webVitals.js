/**
 * Web Vitals performance monitoring
 * Reports Core Web Vitals (LCP, FID, CLS, TTFB, INP) for analytics
 */

const isDevelopment = process.env.NODE_ENV === 'development';

function sendToAnalytics(metric) {
  if (isDevelopment) {
    console.log(`[Web Vital] ${metric.name}: ${metric.value} (${metric.rating})`);
  }
  // Extend: send to analytics endpoint or service
  // if (typeof window !== 'undefined' && window.gtag) {
  //   window.gtag('event', metric.name, {
  //     value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
  //     event_label: metric.id,
  //     non_interaction: true,
  //   });
  // }
}

export function initWebVitals() {
  if (typeof window === 'undefined') return;

  try {
    const { onLCP, onFID, onCLS, onTTFB, onINP } = require('web-vitals');
    onLCP(sendToAnalytics);
    onFID(sendToAnalytics);
    onCLS(sendToAnalytics);
    onTTFB(sendToAnalytics);
    onINP(sendToAnalytics);
  } catch (e) {
    // web-vitals not installed or import failed — fail silently
    if (isDevelopment) {
      console.warn('[WebVitals] web-vitals package not available:', e.message);
    }
  }
}

export function observePerformance() {
  if (typeof window === 'undefined' || !window.PerformanceObserver) return;

  try {
    // Observe Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (isDevelopment) {
        console.log(`[Performance] LCP: ${lastEntry.startTime.toFixed(0)}ms`);
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    // Observe Cumulative Layout Shift
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    // PerformanceObserver not fully supported — fail silently
  }
}

export default { initWebVitals, observePerformance };
