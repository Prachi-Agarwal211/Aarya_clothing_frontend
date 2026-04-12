'use client';

import { useEffect } from 'react';

/**
 * PerformanceOptimizations Component
 * 
 * Handles critical performance optimizations:
 * - Critical CSS inlining
 * - Resource hints injection
 * - Performance monitoring
 * - Connection-aware optimizations
 * - Memory management
 */
export function PerformanceOptimizations() {
  useEffect(() => {
    // 1. Inject critical CSS for above-the-fold content
    const criticalCSS = `
      /* Critical CSS - Above the fold styles */
      .skeleton {
        background: linear-gradient(90deg, rgba(183, 110, 121, 0.1) 25%, rgba(183, 110, 121, 0.2) 50%, rgba(183, 110, 121, 0.1) 75%);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s infinite;
      }
      @keyframes skeleton-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      /* Prevent layout shift for images */
      .next-image-wrapper {
        contain: layout;
      }
      
      /* GPU acceleration for animations */
      .will-animate {
        will-change: transform, opacity;
      }
      
      /* Content visibility for off-screen content */
      .content-auto {
        content-visibility: auto;
        contain-intrinsic-size: 0 500px;
      }
      
      /* Mobile optimizations */
      @media (max-width: 640px) {
        .touch-action {
          touch-action: manipulation;
        }
      }
      
      /* Reduced motion preference */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = criticalCSS;
    styleElement.setAttribute('data-critical', 'true');
    document.head.appendChild(styleElement);

    // 2. Add performance observer for monitoring
    if ('PerformanceObserver' in window) {
      try {
        // Monitor Largest Contentful Paint (LCP)
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          const lcp = lastEntry.startTime;
          
          // Store LCP for analytics
          window.__LCP = lcp;
          console.log('LCP:', lcp.toFixed(2), 'ms');
          
          // Send to analytics endpoint if needed
          if (lcp > 2500) {
            console.warn('LCP is above 2.5s threshold:', lcp);
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Monitor Cumulative Layout Shift (CLS)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          window.__CLS = clsValue;
          console.log('CLS:', clsValue.toFixed(3));
          
          if (clsValue > 0.1) {
            console.warn('CLS is above 0.1 threshold:', clsValue);
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Monitor First Input Delay (FID) / Interaction to Next Paint (INP)
        const fidObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            const fid = entry.processingStart - entry.startTime;
            window.__FID = fid;
            console.log('FID:', fid.toFixed(2), 'ms');
            
            if (fid > 100) {
              console.warn('FID is above 100ms threshold:', fid);
            }
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Monitor Long Tasks
        const longTaskObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            console.warn('Long task detected:', entry.duration.toFixed(2), 'ms');
            // Could send to analytics for monitoring
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });

      } catch (error) {
        console.warn('Performance Observer not fully supported:', error);
      }
    }

    // 3. Implement memory cleanup for long-running sessions
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - reduce resource usage
        document.documentElement.classList.add('page-hidden');
      } else {
        document.documentElement.classList.remove('page-hidden');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Add connection-aware image quality adjustment
    let dataSaverStyle = null;
    const updateImageQuality = () => {
      if ('connection' in navigator) {
        const conn = navigator.connection;
        const isSlow = conn.saveData ||
          conn.effectiveType === '2g' ||
          conn.effectiveType === 'slow-2g';

        if (isSlow) {
          // Add data-saver class for CSS to target
          document.documentElement.classList.add('data-saver');

          // Reduce image quality via CSS filter
          dataSaverStyle = document.createElement('style');
          dataSaverStyle.textContent = `
            .data-saver img {
              filter: blur(0.3px);
            }
          `;
          dataSaverStyle.setAttribute('data-data-saver', 'true');
          document.head.appendChild(dataSaverStyle);
        }
      }
    };

    updateImageQuality();

    // 5. Preconnect to known external domains on idle for faster subsequent requests
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        const origins = [
          'https://pub-7846c786f7154610b57735df47899fa0.r2.dev',
          'https://checkout.razorpay.com',
        ];
        origins.forEach(href => {
          if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
          const link = document.createElement('link');
          link.rel = 'preconnect';
          link.href = href;
          link.crossOrigin = 'anonymous';
          document.head.appendChild(link);
        });
      });
    }

    // FIX: Cleanup all observers on unmount to prevent memory leaks
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Remove dynamically appended style element
      if (dataSaverStyle && dataSaverStyle.parentNode) {
        dataSaverStyle.parentNode.removeChild(dataSaverStyle);
      }
      // Disconnect all performance observers
      try {
        if (typeof lcpObserver !== 'undefined') lcpObserver.disconnect();
        if (typeof clsObserver !== 'undefined') clsObserver.disconnect();
        if (typeof fidObserver !== 'undefined') fidObserver.disconnect();
        if (typeof longTaskObserver !== 'undefined') longTaskObserver.disconnect();
      } catch (e) {
        // Observers may not be defined if browser doesn't support them
      }
    };
  }, []);

  return null;
}

/**
 * usePerformance Hook
 * 
 * Provides performance metrics and utilities
 */
export function usePerformance() {
  useEffect(() => {
    // Log performance metrics on page load
    window.addEventListener('load', () => {
      // Navigation Timing API
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const metrics = {
          // Time to First Byte
          ttfb: timing.responseStart - timing.navigationStart,
          // DOM Interactive
          domInteractive: timing.domInteractive - timing.navigationStart,
          // DOM Content Loaded
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          // Page Load Time
          pageLoad: timing.loadEventEnd - timing.navigationStart,
        };

        console.log('Performance Metrics:', {
          'TTFB (ms)': metrics.ttfb,
          'DOM Interactive (ms)': metrics.domInteractive,
          'DOM Content Loaded (ms)': metrics.domContentLoaded,
          'Page Load (ms)': metrics.pageLoad,
        });

        // Store for analytics
        window.__PERF_METRICS = metrics;
      }
    });
  }, []);

  return {
    getMetrics: () => ({
      lcp: window.__LCP || 0,
      cls: window.__CLS || 0,
      fid: window.__FID || 0,
      ...window.__PERF_METRICS,
    }),
  };
}

export default PerformanceOptimizations;
