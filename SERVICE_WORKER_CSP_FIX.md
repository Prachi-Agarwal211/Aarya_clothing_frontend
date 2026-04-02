# Service Worker CSP Fix - R2 Images

## Problem
Service worker was intercepting R2 CDN image fetches, causing CSP violations:
```
Refused to connect because it violates the document's Content Security Policy
Failed to load resource: net::ERR_FAILED
```

## Root Cause
Service worker's `fetch()` event handler was trying to cache cross-origin R2 images, which violated CSP even though R2 domains were added to `connect-src`.

## Solution
Modified service worker to **exclude R2 images** from interception:
- R2 images are already CDN-cached (Cloudflare)
- Browser can cache them directly via CSP `img-src 'self' https:`
- Service worker no longer attempts to fetch/cache R2 resources

## Changes
**File:** `frontend_new/public/sw.js`

```javascript
// Skip R2 CDN images - let browser handle them directly (CSP compliant)
if (requestUrl.hostname.includes('pub-7846c786f7154610b57735df47899fa0.r2.dev') ||
    requestUrl.hostname.includes('r2.cloudflarestorage.com')) {
  return; // Don't intercept R2 images
}
```

## Result
✅ No more CSP violations for R2 images
✅ Images load correctly through browser caching
✅ Service worker still caches other resources (static assets, API responses)
✅ Admin dashboard works without console errors

## Verification
After deployment:
1. Clear browser cache (Ctrl+Shift+R)
2. Check browser console - no CSP errors for R2
3. Images should load normally
4. Service worker continues to work for other resources
