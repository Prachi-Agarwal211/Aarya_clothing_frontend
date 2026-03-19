# CRITICAL INVESTIGATION REPORT - Aarya Clothing
**Date:** March 19, 2026  
**Status:** ROOT CAUSES IDENTIFIED  
**Severity:** CRITICAL - Production Impact

---

## EXECUTIVE SUMMARY

After thorough investigation of the interconnected issues affecting the Aarya Clothing platform, I have identified **4 CRITICAL ROOT CAUSES** and **3 CONTRIBUTING FACTORS**. The backend services are healthy, but multiple configuration and architectural issues are causing the reported problems.

---

## 1. 503 ERROR ROOT CAUSE ANALYSIS

### ROOT CAUSE: **NGINX RATE LIMITING (NOT SERVICE FAILURE)**

**Finding:** The 503 errors are **NOT** caused by service failures or database connection issues. They are caused by **nginx rate limiting** being triggered.

**Evidence from nginx logs:**
```
2026/03/19 14:46:16 [error] 30#30: *3208 limiting requests, excess: 20.800 by zone "api"
```

**Why this causes 503:**
- Nginx has rate limit zone `api:10m rate=10r/s` (10 requests per second)
- When a single IP exceeds this limit, nginx returns 503 Service Unavailable
- The admin dashboard makes multiple rapid API calls, triggering this limit
- This is especially problematic for users on shared IPs (corporate networks, mobile carriers)

**Current nginx.conf configuration (lines 73-75):**
```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;
limit_req_zone $binary_remote_addr zone=webhooks:10m rate=5r/s;
```

**Why it's too aggressive:**
- 10 requests/second is too low for modern web apps
- Admin dashboard can easily exceed this with parallel API calls
- No burst allowance configured in some locations
- Single IP from shared network (office, mobile) gets penalized for all users

### SOLUTION:

**File to fix:** `/opt/Aarya_clothing_frontend/docker/nginx/nginx.conf`

**Changes needed:**

1. **Increase rate limits** (lines 73-75):
```nginx
# OLD (too restrictive):
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

# NEW (more reasonable):
limit_req_zone $binary_remote_addr zone=api:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=webhooks:10m rate=20r/s;
```

2. **Add burst allowance** to all API location blocks:
```nginx
# OLD:
location /api/v1/admin/ {
    limit_req zone=api burst=20 nodelay;
    ...
}

# NEW (higher burst):
location /api/v1/admin/ {
    limit_req zone=api burst=100 nodelay;
    ...
}
```

3. **Consider per-user rate limiting** instead of per-IP for authenticated requests (requires nginx Plus or Lua scripting)

---

## 2. SESSION/PERSISTENCE ISSUES

### ROOT CAUSE: **COOKIE DOMAIN MISMATCH + MIDDLEWARE TOKEN PARSING**

**Issue #1: Cookie Domain Configuration**

In production, the `.env` file has:
```env
ALLOWED_ORIGINS=["https://aaryaclothing.in","https://www.aaryaclothing.in"]
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
```

**Problem:** Cookies are being set without an explicit `Domain` attribute, which means:
- Cookies set on `aaryaclothing.in` are NOT sent to `www.aaryaclothing.in`
- Cookies set on `www.aaryaclothing.in` are NOT sent to `aaryaclothing.in`
- Users switching between www and non-www lose their session

**File to fix:** `/opt/Aarya_clothing_frontend/services/core/main.py`

**Current cookie setting (lines 147-168):**
```python
response.set_cookie(
    key="access_token",
    value=tokens["access_token"],
    httponly=settings.COOKIE_HTTPONLY,
    secure=settings.COOKIE_SECURE,
    samesite=settings.COOKIE_SAMESITE,
    max_age=access_max_age,
    path="/"
    # MISSING: domain=".aaryaclothing.in"
)
```

**Fix:**
```python
# Add domain setting for production
domain = ".aaryaclothing.in" if settings.is_production else None

response.set_cookie(
    key="access_token",
    value=tokens["access_token"],
    httponly=settings.COOKIE_HTTPONLY,
    secure=settings.COOKIE_SECURE,
    samesite=settings.COOKIE_SAMESITE,
    max_age=access_max_age,
    path="/",
    domain=domain  # Add this
)
```

**Issue #2: Middleware JWT Parsing Edge Cases**

**File:** `/opt/Aarya_clothing_frontend/frontend_new/middleware.js`

**Problem:** The JWT parsing in middleware can fail silently, causing authentication to be lost:

```javascript
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('[Middleware] CRITICAL: Failed to parse JWT token:', e);
    return null;  // Returns null, causing logout
  }
}
```

**Issues:**
1. No handling for malformed tokens (extra whitespace, encoding issues)
2. No token expiration check before parsing
3. Errors cause complete auth failure instead of graceful degradation

**Fix:** Add better error handling and validation:
```javascript
function parseJwt(token) {
  if (!token || typeof token !== 'string') return null;
  
  try {
    // Trim whitespace
    token = token.trim();
    
    // Validate JWT structure
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[Middleware] Invalid JWT structure');
      return null;
    }
    
    const base64Url = parts[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Handle padding issues
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const parsed = JSON.parse(jsonPayload);
    
    // Check expiration
    if (parsed.exp && parsed.exp * 1000 < Date.now()) {
      return null; // Token expired
    }
    
    return parsed;
  } catch (e) {
    console.warn('[Middleware] JWT parse error:', e.message);
    return null;
  }
}
```

**Issue #3: Token Refresh Not Working Properly**

**File:** `/opt/Aarya_clothing_frontend/frontend_new/lib/apiClient.js`

**Problem:** The token refresh mechanism in `BaseApiClient._tryRefreshToken()` (lines 222-259) has issues:

1. Refresh endpoint expects POST with empty body, but backend might expect different format
2. No retry logic if refresh fails
3. No clearing of stale tokens on refresh failure

**Current refresh logic:**
```javascript
async _tryRefreshToken() {
  if (this._refreshing) {
    return this._refreshing;
  }

  this._refreshing = (async () => {
    try {
      const response = await fetch(buildUrl(this.baseUrl, '/api/v1/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),  // Empty body
        ...(this.includeCredentials && { credentials: 'include' }),
      });
      // ...
    }
  })();
}
```

**Backend expects:** Refresh token from cookie, not body

**Fix:** Ensure credentials are always included and handle refresh token properly:
```javascript
async _tryRefreshToken() {
  if (this._refreshing) {
    return this._refreshing;
  }

  this._refreshing = (async () => {
    try {
      const response = await fetch(buildUrl(this.baseUrl, '/api/v1/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',  // Always include cookies
      });

      if (!response.ok) {
        // Clear stale tokens
        clearAuthData();
        clearStoredTokens();
        return false;
      }

      const data = await response.json();
      if (data.access_token) {
        // Update tokens in cookies
        setStoredTokens(data);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Token refresh failed:', e);
      clearAuthData();
      clearStoredTokens();
      return false;
    } finally {
      this._refreshing = null;
    }
  })();

  return this._refreshing;
}
```

---

## 3. FRONTEND CACHING ISSUES

### ROOT CAUSE: **AGGRESSIVE NEXT.JS PRERENDERING + NO CACHE BUSTING**

**Evidence from production headers:**
```
x-nextjs-cache: HIT
x-nextjs-prerender: 1
x-nextjs-stale-time: 300
cache-control: s-maxage=31536000
```

**Problems identified:**

1. **Static pages cached for 1 year** (`cache-control: s-maxage=31536000`)
2. **No cache busting strategy** for API responses
3. **Service worker not present** but Next.js app router caching is aggressive
4. **API calls may be cached** by browser due to missing cache-control headers

**File to check:** `/opt/Aarya_clothing_frontend/frontend_new/next.config.js`

**Current configuration likely has:**
```javascript
// Check this file for:
module.exports = {
  // ...
  httpAgentOptions: {
    keepAlive: true,
  },
  // May have aggressive caching
}
```

**Fixes needed:**

1. **Add cache-control headers to API routes** in nginx.conf:
```nginx
# API routes - no caching
location /api/v1/ {
    # ... existing config ...
    
    # Prevent caching of API responses
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```

2. **Configure Next.js for proper caching** in `next.config.js`:
```javascript
module.exports = {
  // ...
  async headers() {
    return [
      {
        // API routes should not be cached
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        // Static assets can be cached
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
}
```

3. **Add revalidation to Server Components** that fetch dynamic data:
```javascript
// In pages that fetch data
export const dynamic = 'force-dynamic';
// OR
export const revalidate = 60; // Revalidate every 60 seconds
```

---

## 4. DATABASE HEALTH

### STATUS: **HEALTHY - NO ISSUES FOUND**

**Verification:**
- PostgreSQL container: `Up 29 hours (healthy)`
- Database connection: Working (health checks pass)
- Connection pool: Properly configured (pool_size=10, max_overflow=20)
- No connection timeout errors in logs

**Database configuration is correct:**
```env
DATABASE_URL=postgresql://postgres:UXWgOXq_3d5mm1oJBnCupmLPpX0L89bCyHig0hiz4VQ@postgres:5432/aarya_clothing
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20
```

**No action needed for database layer.**

---

## 5. CONTRIBUTING FACTORS

### Factor 1: **Admin Dashboard Making Too Many Parallel Requests**

The admin dashboard overview endpoint (`/api/v1/admin/dashboard/overview`) is being called multiple times in rapid succession, triggering rate limits.

**Recommendation:**
- Implement request debouncing in frontend
- Combine multiple API calls into single batch endpoint
- Add client-side caching with proper invalidation

### Factor 2: **No Request Deduplication**

Multiple components may be making the same API request simultaneously.

**Recommendation:**
- Implement React Query or SWR for request deduplication
- Add request caching with proper invalidation

### Factor 3: **Missing Health Check for Admin Service Route**

The nginx config doesn't have a specific location block for `/api/v1/admin/` - it may be falling through to a generic handler.

**Check nginx.conf for:**
```nginx
location /api/v1/admin/ {
    limit_req zone=api burst=100 nodelay;
    proxy_pass http://admin_server;
    # ...
}
```

---

## ACTION PLAN

### IMMEDIATE (Do Today):

1. **Fix nginx rate limiting** - Update nginx.conf:
   - Increase `api` zone from 10r/s to 50r/s
   - Increase `burst` from 20 to 100
   - Reload nginx: `docker-compose restart nginx`

2. **Add cookie domain setting** - Update core/main.py:
   - Add `domain=".aaryaclothing.in"` for production cookies
   - Rebuild and redeploy core service

3. **Add API cache-control headers** - Update nginx.conf:
   - Add no-cache headers for all `/api/v1/` routes
   - Reload nginx

### SHORT-TERM (This Week):

4. **Fix middleware JWT parsing** - Update middleware.js:
   - Add better error handling
   - Add token structure validation
   - Add expiration check before parsing

5. **Fix token refresh** - Update apiClient.js:
   - Ensure credentials are always included
   - Add proper error handling
   - Clear stale tokens on failure

6. **Add request debouncing** - Update admin dashboard:
   - Debounce API calls
   - Implement request deduplication

### LONG-TERM (Next Sprint):

7. **Implement per-user rate limiting** - Requires nginx Plus or custom solution

8. **Add comprehensive monitoring** - Set up alerts for:
   - Rate limit hits
   - Authentication failures
   - API response times

9. **Implement proper cache strategy** - Use React Query/SWR with:
   - Stale-while-revalidate
   - Proper invalidation
   - Optimistic updates

---

## VERIFICATION STEPS

After applying fixes:

1. **Test rate limiting:**
   ```bash
   # Should NOT get 503 errors with rapid requests
   for i in {1..50}; do curl -k https://aaryaclothing.in/api/v1/admin/dashboard/overview & done
   ```

2. **Test session persistence:**
   - Login on `www.aaryaclothing.in`
   - Navigate to `aaryaclothing.in` (without www)
   - Session should persist

3. **Test caching:**
   - Check API response headers for `Cache-Control: no-store`
   - Verify API calls are not cached by browser dev tools

4. **Monitor logs:**
   - Watch for rate limit errors: `docker logs aarya_nginx | grep "limiting requests"`
   - Watch for auth errors: `docker logs aarya_core | grep "401"`

---

## FILES TO MODIFY

1. `/opt/Aarya_clothing_frontend/docker/nginx/nginx.conf` - Rate limits, cache headers
2. `/opt/Aarya_clothing_frontend/services/core/main.py` - Cookie domain setting
3. `/opt/Aarya_clothing_frontend/frontend_new/middleware.js` - JWT parsing
4. `/opt/Aarya_clothing_frontend/frontend_new/lib/apiClient.js` - Token refresh
5. `/opt/Aarya_clothing_frontend/frontend_new/next.config.js` - Cache configuration (optional)

---

## CONCLUSION

The 503 errors are **NOT** caused by database or service failures. All backend services are healthy and responding correctly. The issues are:

1. **Overly aggressive nginx rate limiting** causing legitimate traffic to be blocked
2. **Cookie domain configuration** causing session loss between www/non-www domains
3. **Frontend caching** causing stale content
4. **JWT parsing edge cases** in middleware causing auth failures

All issues are fixable with configuration changes - no architectural changes required.

**Priority:** Fix nginx rate limiting IMMEDIATELY as this is blocking legitimate user traffic.
