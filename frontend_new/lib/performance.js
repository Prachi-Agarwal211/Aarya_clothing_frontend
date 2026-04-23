/**
 * Performance Utilities
 * 
 * Helper functions for optimizing React components:
 * - Memoization utilities
 * - Debounce/throttle functions
 * - Request idle callback wrapper
 * - Virtual scroll helpers
 */

import React from 'react';

/**
 * Debounce function - delays execution until after wait milliseconds
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - limits execution to once per interval
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Request Idle Callback wrapper with fallback
 * @param {Function} callback - Function to execute when idle
 * @param {Object} options - Options for requestIdleCallback
 */
export function requestIdle(callback, options = {}) {
  if ('requestIdleCallback' in window) {
    return requestIdleCallback(callback, options);
  }
  // Fallback to setTimeout
  return setTimeout(callback, 1);
}

/**
 * Cancel Idle Callback wrapper with fallback
 * @param {number} id - ID from requestIdleCallback
 */
export function cancelIdleCallback(id) {
  if ('cancelIdleCallback' in window) {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Check if element is in viewport
 * @param {Element} element - Element to check
 * @param {number} threshold - Threshold percentage (0-1)
 * @returns {boolean} True if in viewport
 */
export function isInViewport(element, threshold = 0) {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  
  return (
    rect.top <= viewportHeight * (1 - threshold) &&
    rect.bottom >= 0 &&
    rect.left <= viewportWidth * (1 - threshold) &&
    rect.right >= 0
  );
}

/**
 * Get all elements in viewport
 * @param {NodeList} elements - Elements to check
 * @param {number} threshold - Threshold percentage
 * @returns {Array} Elements in viewport
 */
export function getElementsInViewport(elements, threshold = 0) {
  return Array.from(elements).filter(el => isInViewport(el, threshold));
}

/**
 * Virtual scroll calculator
 * @param {number} itemCount - Total number of items
 * @param {number} itemHeight - Height of each item in pixels
 * @param {number} containerHeight - Height of visible container
 * @param {number} scrollTop - Current scroll position
 * @returns {Object} { startIndex, endIndex, offsetY }
 */
export function calculateVirtualScroll({
  itemCount,
  itemHeight,
  containerHeight,
  scrollTop,
}) {
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight));
  const endIndex = Math.min(itemCount, startIndex + visibleCount + 1); // Render one extra
  const offsetY = startIndex * itemHeight;
  
  return {
    startIndex,
    endIndex,
    offsetY,
    visibleCount,
  };
}

/**
 * Memoize function with cache size limit
 * @param {Function} fn - Function to memoize
 * @param {number} maxCacheSize - Maximum cache size
 * @returns {Function} Memoized function
 */
export function memoize(fn, maxCacheSize = 100) {
  const cache = new Map();
  
  return function memoized(...args) {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      // Move to end (most recently used)
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }
    
    const value = fn.apply(this, args);
    cache.set(key, value);
    
    // Limit cache size
    if (cache.size > maxCacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return value;
  };
}

/**
 * Lazy load component with skeleton
 * @param {Function} importFunc - Dynamic import function
 * @param {React.Component} SkeletonComponent - Skeleton to show while loading
 * @returns {React.Component} Lazy loaded component
 */
export function lazyWithSkeleton(importFunc, SkeletonComponent) {
  return React.lazy(() => 
    importFunc().then(module => ({
      default: props => (
        <React.Suspense fallback={<SkeletonComponent />}>
          <module.default {...props} />
        </React.Suspense>
      )
    }))
  );
}

/**
 * Optimize image loading based on connection
 * @returns {Object} Image optimization settings
 */
export function getConnectionAwareImageSettings() {
  const defaultSettings = {
    quality: 75,
    loading: 'lazy',
    decoding: 'async',
  };
  
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const conn = navigator.connection;
    const isSlow = conn.saveData || 
      conn.effectiveType === '2g' || 
      conn.effectiveType === 'slow-2g';
    
    if (isSlow) {
      return {
        quality: 50,
        loading: 'lazy',
        decoding: 'async',
        placeholder: 'blur',
      };
    }
    
    // Fast connection
    if (conn.effectiveType === '4g' && conn.downlink > 10) {
      return {
        quality: 85,
        loading: 'eager',
        decoding: 'async',
        placeholder: 'blur',
      };
    }
  }
  
  return defaultSettings;
}

/**
 * Measure component render time
 * @param {string} componentName - Name of component
 * @param {Function} callback - Render callback
 * @returns {any} Result of callback
 */
export function measureRenderTime(componentName, callback) {
  const startTime = performance.now();
  const result = callback();
  const endTime = performance.now();
  
  console.log(`[${componentName}] Render time: ${(endTime - startTime).toFixed(2)}ms`);
  return result;
}

/**
 * Batch multiple state updates
 * @param {Function} fn - Function with state updates
 */
export function batchUpdates(fn) {
  if (React && React.unstable_batchedUpdates) {
    React.unstable_batchedUpdates(fn);
  } else {
    fn();
  }
}

/**
 * Create intersection observer for lazy loading
 * @param {Function} callback - Callback when element is visible
 * @param {Object} options - IntersectionObserver options
 * @returns {IntersectionObserver} Observer instance
 */
export function createLazyLoadObserver(callback, options = {}) {
  const defaultOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        callback(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { ...defaultOptions, ...options });
  
  return observer;
}

/**
 * Preload resource with priority
 * @param {string} href - Resource URL
 * @param {string} as - Resource type (image, script, style, font)
 * @param {string} priority - Priority (high, medium, low)
 */
export function preloadResource(href, as, priority = 'high') {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = href;
  
  if (priority === 'high') {
    link.fetchPriority = 'high';
  } else if (priority === 'low') {
    link.fetchPriority = 'low';
  }
  
  document.head.appendChild(link);
}

/**
 * Check if user prefers reduced motion
 * @returns {boolean} True if reduced motion is preferred
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers reduced data usage
 * @returns {boolean} True if save-data is enabled
 */
export function prefersSaveData() {
  if (typeof navigator === 'undefined' || !navigator.connection) return false;
  return navigator.connection.saveData === true;
}

/**
 * Get effective connection type
 * @returns {string} Connection type (slow-2g, 2g, 3g, 4g)
 */
export function getEffectiveConnectionType() {
  if (typeof navigator === 'undefined' || !navigator.connection) return '4g';
  return navigator.connection.effectiveType || '4g';
}

/**
 * Performance budget checker
 * @param {Object} budget - Performance budget in KB
 * @returns {Object} Current usage vs budget
 */
export function checkPerformanceBudget(budget = {
  scripts: 300,
  styles: 100,
  images: 500,
  fonts: 100,
  total: 1000,
}) {
  const resources = performance.getEntriesByType('resource');
  
  const usage = {
    scripts: 0,
    styles: 0,
    images: 0,
    fonts: 0,
    total: 0,
  };
  
  resources.forEach(resource => {
    const size = resource.transferSize || 0;
    usage.total += size;
    
    if (resource.name.endsWith('.js')) {
      usage.scripts += size;
    } else if (resource.name.endsWith('.css')) {
      usage.styles += size;
    } else if (/\.(jpg|jpeg|png|gif|webp|avif|svg)$/.test(resource.name)) {
      usage.images += size;
    } else if (/\.(woff|woff2|ttf|otf)$/.test(resource.name)) {
      usage.fonts += size;
    }
  });
  
  // Convert to KB
  Object.keys(usage).forEach(key => {
    usage[key] = Math.round(usage[key] / 1024);
  });
  
  const violations = [];
  Object.keys(budget).forEach(key => {
    if (usage[key] > budget[key]) {
      violations.push(`${key}: ${usage[key]}KB / ${budget[key]}KB`);
    }
  });
  
  return {
    usage,
    budget,
    violations,
    passed: violations.length === 0,
  };
}

export default {
  debounce,
  throttle,
  requestIdle,
  cancelIdleCallback,
  isInViewport,
  getElementsInViewport,
  calculateVirtualScroll,
  memoize,
  getConnectionAwareImageSettings,
  measureRenderTime,
  batchUpdates,
  createLazyLoadObserver,
  preloadResource,
  prefersReducedMotion,
  prefersSaveData,
  getEffectiveConnectionType,
  checkPerformanceBudget,
};
