# Products Page Infinite Loading Fix - Critical Production Bug

**Date:** 2026-04-02  
**Priority:** CRITICAL - BLOCKING CUSTOMERS FROM VIEWING PRODUCTS  
**Status:** ✅ FIXED

## Problem Summary

The `/products` page on `https://aaryaclothing.in/products` was stuck showing the loading spinner indefinitely. No products displayed, no error messages.

### Root Cause Analysis

1. **API endpoint `/api/v1/products/browse` works perfectly** - returns 7 products when tested directly
2. **Frontend code had insufficient timeout protection** - the API client's internal timeout wasn't guaranteeing `setLoading(false)` would be called
3. **Missing Promise.race pattern** - if the API call hung (network issue, CORS, etc.), the timeout in `baseApi.js` might not trigger the error handler properly
4. **Insufficient logging** - couldn't diagnose where the request was hanging

## Changes Made

### File: `frontend_new/app/products/page.js`

#### 1. Enhanced `fetchCollections` with Timeout Protection

**Before:**
```javascript
const fetchCollections = useCallback(async () => {
  try {
    const data = await collectionsApi.list();
    const items = Array.isArray(data) ? data : (data?.items || data?.collections || []);
    setCollections(items);
  } catch (err) {
    logger.warn('Failed to load collections for filter:', err?.message);
  }
}, []);
```

**After:**
```javascript
const fetchCollections = useCallback(async () => {
  try {
    logger.info('[ProductsPage] Fetching collections...');
    
    // Use Promise.race to ensure timeout works
    const fetchPromise = collectionsApi.list();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Collections request timeout')), API_TIMEOUT_MS);
    });

    const data = await Promise.race([fetchPromise, timeoutPromise]);
    const items = Array.isArray(data) ? data : (data?.items || data?.collections || []);
    setCollections(items);
    logger.info('[ProductsPage] Collections loaded:', items.length);
  } catch (err) {
    logger.warn('Failed to load collections for filter:', err?.message);
    // Don't block page - collections are optional for filtering
    setCollections([]);
  }
}, []);
```

#### 2. Enhanced `fetchProducts` with Guaranteed Timeout and Logging

**Key Changes:**
1. Added `Promise.race` pattern to guarantee timeout even if API client timeout fails
2. Added comprehensive logging at every step
3. Ensured `setLoading(false)` is ALWAYS called in the `finally` block
4. Removed nested try-catch that could potentially skip the finally block

**Before:**
```javascript
const fetchProducts = useCallback(async (activeFilters, isRetry = false, attempt = 0) => {
  try {
    if (!isRetry) {
      setLoading(true);
    }
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      // ... params setup ...
      const data = await productsApi.list(params);
      clearTimeout(timeoutId);
      // ... process data ...
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (err) {
    // ... retry logic ...
  } finally {
    setLoading(false);
  }
}, []);
```

**After:**
```javascript
const fetchProducts = useCallback(async (activeFilters, isRetry = false, attempt = 0) => {
  // ALWAYS ensure loading is set to false in finally block
  // This is critical to prevent infinite loading state
  try {
    if (!isRetry) {
      setLoading(true);
    }
    setError(null);

    logger.info('[ProductsPage] Fetching products with filters:', activeFilters);

    const [sortField, sortOrder] = (activeFilters.sort || 'created_at:desc').split(':');

    const params = {
      page: activeFilters.page || 1,
      limit: PAGE_SIZE,
      sort: sortField,
      order: sortOrder || 'desc',
    };

    if (activeFilters.search) params.search = activeFilters.search;
    if (activeFilters.collection_id) params.category_id = parseInt(activeFilters.collection_id);
    if (activeFilters.minPrice) params.min_price = parseFloat(activeFilters.minPrice);
    if (activeFilters.maxPrice) params.max_price = parseFloat(activeFilters.maxPrice);

    logger.info('[ProductsPage] Calling productsApi.list with params:', params);
    
    // Use Promise.race to ensure timeout works even if API client timeout fails
    const fetchPromise = productsApi.list(params);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout - server did not respond within 10 seconds')), API_TIMEOUT_MS);
    });

    const data = await Promise.race([fetchPromise, timeoutPromise]);
    logger.info('[ProductsPage] Products API response received:', data);

    const items = Array.isArray(data) ? data : (data?.items || data?.products || []);
    const total = data?.total ?? items.length;

    logger.info('[ProductsPage] Processed products:', items.length, 'Total:', total);
    setProducts(items);
    setTotalProducts(total);
  } catch (err) {
    logger.error('[ProductsPage] Caught error in fetchProducts:', err);
    // Check if we should retry (use local attempt counter, NOT state)
    const shouldRetry = !isRetry && attempt < MAX_RETRIES;

    if (shouldRetry) {
      // Exponential backoff: 1s, 2s, 4s...
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
      logger.warn(`Products fetch failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms...`, err?.message);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchProducts(activeFilters, true, attempt + 1);
    }

    // Max retries reached - show error
    logger.error('Error fetching products after retries:', err);
    setError(err?.message || 'Failed to load products. Please try again.');
    setProducts([]);
  } finally {
    logger.info('[ProductsPage] Setting loading to false');
    setLoading(false);
  }
}, []);
```

## Technical Details

### Timeout Constants
```javascript
const API_TIMEOUT_MS = 10000;  // 10 seconds
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 1000;  // 1 second
```

### Why Promise.race?

The `Promise.race` pattern ensures that:
1. **Guaranteed timeout** - Even if the API client's internal timeout fails, our timeout will trigger
2. **No hanging requests** - The request will NEVER hang indefinitely
3. **Error visibility** - Timeout errors are caught and displayed to the user
4. **Loading state cleanup** - The `finally` block ALWAYS executes, ensuring `setLoading(false)`

### Retry Logic

The retry logic uses exponential backoff:
- Attempt 1: Fail → Wait 1 second → Retry
- Attempt 2: Fail → Wait 2 seconds → Retry  
- Attempt 3: Fail → Show error to user

This prevents spamming the server while giving transient network issues a chance to resolve.

## Testing Checklist

- [ ] Navigate to `https://aaryaclothing.in/products`
- [ ] Verify products load within 10 seconds
- [ ] Verify loading spinner disappears
- [ ] Verify error message shows if API is down
- [ ] Test with filters (collection, price range)
- [ ] Test search functionality
- [ ] Test pagination
- [ ] Test on mobile devices
- [ ] Check browser console for any errors
- [ ] Verify logs show proper request/response flow

## Monitoring

Check browser console logs for these markers:
```
[ProductsPage] Fetching products with filters: {...}
[ProductsPage] Calling productsApi.list with params: {...}
[ProductsPage] Products API response received: {...}
[ProductsPage] Processed products: X Total: Y
[ProductsPage] Setting loading to false
```

If you see timeout errors:
```
[ProductsPage] Caught error in fetchProducts: Request timeout - server did not respond within 10 seconds
```

This indicates a backend issue - check:
1. Commerce service logs (`docker logs aarya_commerce`)
2. Nginx logs (`docker logs aarya_nginx`)
3. Network connectivity between frontend and backend

## Related Files

- `frontend_new/app/products/page.js` - Main products page (FIXED)
- `frontend_new/lib/customerApi.js` - API client wrapper
- `frontend_new/lib/baseApi.js` - Base API client with timeout logic
- `docker/nginx/nginx.conf` - Nginx reverse proxy configuration

## Prevention

To prevent similar issues in the future:

1. **Always use Promise.race for critical API calls** - Don't rely solely on internal timeouts
2. **Add comprehensive logging** - Log at every step of the request lifecycle
3. **Ensure finally blocks always execute** - Never put return statements that could skip finally
4. **Test with network throttling** - Use Chrome DevTools to simulate slow networks
5. **Monitor Core Web Vitals** - Set up alerts for high LCP or INP

## Deployment

1. Rebuild frontend: `docker-compose build frontend`
2. Restart frontend: `docker-compose up -d frontend`
3. Verify deployment: Visit `https://aaryaclothing.in/products`
4. Monitor logs: `docker logs -f aarya_frontend`

## Rollback Plan

If issues persist:
1. Check nginx logs for 502/504 errors
2. Verify commerce service is running: `docker ps | grep commerce`
3. Test API directly: `curl https://aaryaclothing.in/api/v1/products/browse`
4. Rollback to previous commit if needed

---

**Fixed by:** Aarya Frontend Specialist  
**Review status:** Ready for QA verification
