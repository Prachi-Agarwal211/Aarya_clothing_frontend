# Performance Optimization Quick Reference

## 🚀 Quick Start

### Run Performance Tests
```bash
# Full performance audit
npm run perf:test

# Quick Lighthouse audit
npm run perf:audit

# Generate performance report
npm run perf:report
```

### Build with Bundle Analysis
```bash
npm run build:analyze
```

---

## 📋 Checklist for New Components

### Images
- [ ] Use `OptimizedImage` component instead of raw `<img>`
- [ ] Set `priority={true}` for above-fold images
- [ ] Use `loading="eager"` for LCP images, `loading="lazy"` for others
- [ ] Include `sizes` attribute for responsive images
- [ ] Set appropriate `quality` (75 for mobile, 85 for desktop)
- [ ] Add `decoding="async"` for non-blocking rendering

```jsx
import OptimizedImage from '@/components/ui/OptimizedImage';

<OptimizedImage
  src="/product.jpg"
  alt="Product name"
  priority={true}  // For above-fold
  loading="eager"  // For LCP images
  sizes="(max-width: 640px) 100vw, 50vw"
  quality={75}
  decoding="async"
/>
```

### Components
- [ ] Use `React.memo()` for frequently-rendered components
- [ ] Implement `React.lazy()` for heavy components
- [ ] Add skeleton loaders for async content
- [ ] Use `content-visibility: auto` for long lists

```jsx
import dynamic from 'next/dynamic';
import { memo } from 'react';

// Lazy load heavy components
const HeavyComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  { 
    loading: () => <SkeletonLoader />,
    ssr: false 
  }
);

// Memoize frequent renders
const MemoizedComponent = memo(({ data }) => {
  return <div>{data}</div>;
});
```

### CSS
- [ ] Use `will-change` sparingly for animations
- [ ] Add `content-visibility: auto` for off-screen content
- [ ] Respect `prefers-reduced-motion`
- [ ] Use CSS containment where appropriate

```css
/* GPU acceleration */
.animated-element {
  will-change: transform, opacity;
}

/* Defer off-screen rendering */
.long-list {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px;
}

/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 🔧 Performance Utilities

### Debounce & Throttle
```javascript
import { debounce, throttle } from '@/lib/performance';

// Debounce search input
const debouncedSearch = debounce((query) => {
  searchAPI(query);
}, 300);

// Throttle scroll handler
const throttledScroll = throttle(() => {
  updateScrollPosition();
}, 100);
```

### Request Idle Callback
```javascript
import { requestIdle } from '@/lib/performance';

// Execute during idle periods
requestIdle(() => {
  // Non-urgent work
  loadAnalytics();
});
```

### Virtual Scroll
```javascript
import { calculateVirtualScroll } from '@/lib/performance';

const { startIndex, endIndex, offsetY } = calculateVirtualScroll({
  itemCount: 1000,
  itemHeight: 50,
  containerHeight: 600,
  scrollTop: 200,
});

// Render only visible items
const visibleItems = items.slice(startIndex, endIndex);
```

---

## 📊 Performance Budgets

| Metric | Budget | Critical |
|--------|--------|----------|
| **Lighthouse Score** | 90+ | <80 |
| **LCP** | <2.5s | >4s |
| **FID** | <100ms | >300ms |
| **CLS** | <0.1 | >0.25 |
| **Bundle Size** | <750KB | >1MB |
| **Image Size** | <100KB each | >500KB |
| **Font Size** | <100KB total | >200KB |

---

## 🛠️ Debugging Tools

### Chrome DevTools
```javascript
// Check Core Web Vitals
console.log('LCP:', window.__LCP);
console.log('CLS:', window.__CLS);
console.log('FID:', window.__FID);

// Check service worker
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW Status:', reg?.active?.state);
});

// Check caches
caches.keys().then(names => {
  console.log('Caches:', names);
});

// Performance timeline
performance.getEntriesByType('paint').forEach(entry => {
  console.log(`${entry.name}: ${entry.startTime.toFixed(2)}ms`);
});
```

### Lighthouse CI
```bash
# Run Lighthouse in CI
npm install -g @lhci/cli
lhci autorun
```

### Bundle Analysis
```bash
# Analyze bundle
npm run build:analyze

# Open bundle visualization
open .next/analyze/index.html
```

---

## 🎯 Common Issues & Solutions

### High LCP (>4s)
**Problem:** Largest Contentful Paint is slow

**Solutions:**
1. Add `priority={true}` to LCP image
2. Use `loading="eager"` for hero images
3. Preload critical images: `<link rel="preload" as="image" href="..." />`
4. Reduce image quality: `quality={75}`
5. Add blur placeholder: `placeholder="blur"`

### High CLS (>0.1)
**Problem:** Layout shifts during page load

**Solutions:**
1. Always set `width` and `height` on images
2. Use `aspect-ratio` CSS property
3. Add font fallbacks: `fallback: ['Georgia', 'serif']`
4. Reserve space for dynamic content
5. Use `contain: layout` for isolated components

### High FID (>300ms)
**Problem:** Slow first input response

**Solutions:**
1. Break up long tasks with `requestIdleCallback`
2. Use web workers for heavy computation
3. Debounce/throttle event handlers
4. Code split heavy components
5. Reduce JavaScript bundle size

### Large Bundle (>1MB)
**Problem:** Bundle size too large

**Solutions:**
1. Use `dynamic()` imports for heavy components
2. Tree-shake libraries (e.g., `lucide-react` icons)
3. Remove unused dependencies
4. Use `@next/bundle-analyzer` to identify bloat
5. Enable `optimizePackageImports` in `next.config.js`

---

## 📱 Mobile-Specific Optimizations

### Touch Targets
```jsx
// Minimum 44x44px touch target
<button className="min-w-[44px] min-h-[44px] flex items-center justify-center">
  <Icon className="w-5 h-5" />
</button>
```

### Prevent Zoom on Input
```css
/* Prevent iOS zoom on input focus */
input, textarea, select {
  font-size: 16px !important;
}
```

### Connection-Aware Loading
```javascript
import { getConnectionAwareImageSettings } from '@/lib/performance';

const imageSettings = getConnectionAwareImageSettings();
// Returns: { quality: 50, loading: 'lazy', ... } for slow connections
```

---

## 🔍 Performance Monitoring

### Real User Monitoring (RUM)
```javascript
// In components/PerformanceOptimizations.jsx
const lcpObserver = new PerformanceObserver((entryList) => {
  const lcp = entryList.getEntries().pop().startTime;
  console.log('LCP:', lcp.toFixed(2), 'ms');
  // Send to analytics
});
lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
```

### Performance Observer
```javascript
// Monitor long tasks
const taskObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.duration > 50) {
      console.warn('Long task:', entry.duration.toFixed(2), 'ms');
    }
  });
});
taskObserver.observe({ entryTypes: ['longtask'] });
```

---

## 📚 Resources

- [Next.js Performance Guide](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Web.dev Performance](https://web.dev/performance/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Lighthouse Documentation](https://developer.chrome.com/docs/lighthouse/overview/)

---

**Last Updated:** March 30, 2026  
**Maintained By:** Frontend Team
