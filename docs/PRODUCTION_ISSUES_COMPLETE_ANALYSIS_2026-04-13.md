# Production Issues — Complete Analysis & Fix Plan

**Date:** 2026-04-13  
**Status:** 🔴 Critical Issues Found  
**Domain:** aaryaclothing.in  

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Issue #1: Infinite Redirect Loop (Site Hangs/Lags)](#issue-1-infinite-redirect-loop-site-hangslags)
3. [Issue #2: /api/v1/me Returns 404 (Profile Broken)](#issue-2-apiv1me-returns-404-profile-broken)
4. [Issue #3: Cart Not Working After Login](#issue-3-cart-not-working-after-login)
5. [Issue #4: Collections SSR Fetch Fails](#issue-4-collections-ssr-fetch-fails)
6. [Issue #5: Video Uploads Not Loading](#issue-5-video-uploads-not-loading)
7. [Issue #6: Admin Image Delete Route Mismatch](#issue-6-admin-image-delete-route-mismatch)
8. [Issue #7: PgBouncer Running But Unused](#issue-7-pgbouncer-running-but-unused)
9. [Issue #8: Missing /me Endpoint in Commerce](#issue-8-missing-me-endpoint-in-commerce)
10. [Fix Plan — Priority Order](#fix-plan--priority-order)

---

## Executive Summary

On 2026-04-13, the production site experienced a cascading failure chain:

1. **SECRET_KEY was insecure** → core & commerce crashed → **502 Bad Gateway** across all API endpoints
2. After fixing SECRET_KEY → **admin/payment services still had old key** → JWT tokens failed validation → **Admin dashboard showed no data** (401 errors)
3. After fixing all SECRET_KEYs → **site loads** but deeper issues surfaced:
   - **Infinite redirect loop** on HTTP port 80 → frontend SSR fetch failures → site hangs
   - **Missing `/me` endpoint** → profile page broken
   - **Cart requires auth** but all sessions were invalidated by SECRET_KEY rotation
   - **Collections page SSR fails** due to redirect loop
   - **Video uploads** — need investigation

**Current Live Data in Database:**
- Products: **61**
- Orders: **9**
- Users: **318**
- Collections: **9**

---

## Issue #1: Infinite Redirect Loop (Site Hangs/Lags)

### Severity: 🔴 CRITICAL

### Symptom
Frontend Next.js SSR makes internal API calls to `http://nginx:80/api/v1/collections` and gets stuck in an infinite redirect loop:

```
http://nginx:80/api/v1/collections
  → 301 → http://nginx/api/v1/collections/   (port dropped!)
  → 307 → http://nginx/api/v1/collections    (trailing slash removed)
  → 301 → http://nginx/api/v1/collections/   (trailing slash re-added)
  → 307 → http://nginx/api/v1/collections
  → ... infinite loop (38+ failures in logs)
```

### Root Cause
The nginx HTTP server (`:80`) has a redirect logic in `location /`:

```nginx
location / {
    if ($is_internal_request = 0) {
        return 301 https://$host$request_uri;
    }
    proxy_pass http://$frontend_backend;
    ...
}
```

The problem: when the frontend calls `http://nginx:80/api/v1/collections`, nginx detects it as **internal** (IP matches 172.x), so it proxies to the frontend. But the **API routes** (`/api/v1/collections`) are matched separately and work fine.

The **real redirect loop** happens because:
1. nginx has `location /api/v1/collections/` (with trailing slash) — works
2. Frontend calls `/api/v1/collections` (no trailing slash) — gets 301 to add slash
3. The 301 redirect goes to `http://nginx/api/v1/collections/` (no port)
4. Next request comes to port 80 but with `Host: nginx` (no port)
5. `$is_internal_request` = 0 (no X-Forwarded-For header)
6. Returns 301 to HTTPS → but internal call gets confused → 307 back to HTTP
7. Loop repeats

### Evidence
```
docker exec aarya_frontend node -e "fetch('http://nginx:80/api/v1/collections', {redirect:'manual'})"
→ 301 http://nginx/api/v1/collections/

docker exec aarya_frontend node -e "fetch('http://nginx:80/api/v1/collections/', {redirect:'manual'})"
→ 307 http://nginx/api/v1/collections
```

### Impact
- **38+ fetch failures** in frontend logs
- Collections page loads without data
- Site feels slow/hung on laptop
- Any SSR call to collections, categories, or other trailing-slash-mismatched routes fails
- Mobile users experience worst impact (retries 3x before giving up)

### Fix
Two approaches:

**Option A (Recommended):** Remove the trailing-slash redirect for API routes
```nginx
# Add redirect stripping for /api/v1/ routes — always use NO trailing slash
location ~ ^/api/v1/.*(/)$ {
    return 301 $scheme://$host$request_uri;  # strip trailing slash
}
```

**Option B:** Fix the `Host` header to preserve port in internal redirects
```nginx
# In location / block, set proper internal Host
proxy_set_header Host $http_host;  # preserves port
```

---

## Issue #2: /api/v1/me Returns 404 (Profile Broken)

### Severity: 🔴 CRITICAL

### Symptom
```
curl https://aaryaclothing.in/api/v1/me
→ {"detail":"Not Found"}

curl http://commerce:5002/api/v1/me
→ HTTP 404 Not Found
```

### Root Cause
The nginx config has routing for `/api/v1/me` → commerce:5002 (lines 349-370 in HTTP block, lines 1089-1110 in HTTPS block), but **the commerce service does NOT implement a `/me` endpoint**.

Searched all commerce files:
- `services/commerce/main.py` — no `/me` route
- `services/commerce/routes/*.py` — no `/me` route
- Only match: `/measurements` in size_guide.py (unrelated)

### Impact
- Profile page completely broken
- No user profile data
- No order history for logged-in users
- Any frontend component calling `/api/v1/me` fails

### Fix
Add `/me` endpoint to commerce service that returns user profile data:

```python
@app.get("/api/v1/me", tags=["Profile"])
async def get_my_profile(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Get current user's profile."""
    # Call core service to get user data
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.CORE_SERVICE_URL}/api/v1/users/me",
            headers={"Authorization": f"Bearer {user.get('token', '')}"}
        )
        return resp.json()
```

**Or alternatively:** Change nginx to route `/api/v1/me` → core:5001 instead of commerce.

---

## Issue #3: Cart Not Working After Login

### Severity: 🔴 CRITICAL

### Symptom
- Cart icon shows empty
- Adding items to cart doesn't persist
- Cart API returns `{"detail":"Not authenticated"}`

### Root Cause
**Two-part problem:**

1. **SECRET_KEY rotation invalidated ALL existing sessions.** After we changed the SECRET_KEY from `dev_secret_key_change_in_production` to the new secure key, every JWT token, refresh token, and session cookie became invalid (signed with old key). Users **must re-login**.

2. **Cart requires authentication.** The cart routes are defined at:
   - `@app.get("/api/v1/cart")` (line 835)
   - `@app.post("/api/v1/cart/items")` (line 847)
   - `@app.put("/api/v1/cart/items/{product_id}")` (line 911)
   - `@app.delete("/api/v1/cart/items/{product_id}")` (line 926)

   All require `get_current_user` dependency → returns 401 for unauthenticated/guest users.

### Evidence
```
curl -X POST https://aaryaclothing.in/api/v1/cart/items -H "Content-Type: application/json" -d '{"product_id": 102, "quantity": 1}'
→ {"detail":"Not authenticated"}
```

### Impact
- Users cannot add items to cart
- Guest checkout broken
- Revenue loss — cart is core conversion funnel

### Fix
1. **Users must re-login** to get new JWT tokens (automatic after SECRET_KEY change)
2. **Consider guest cart support** — allow cart without login (store in Redis by session ID)
3. **Check cart routes require proper auth dependency** — verify `get_current_user` is correctly applied

---

## Issue #4: Collections SSR Fetch Fails

### Severity: 🟡 HIGH

### Symptom
```
docker logs aarya_frontend | grep "fetch failed"
→ 38 occurrences
→ "Error fetching collection data: Error [TypeError]: fetch failed"
→ "[Collections] Fetch failed (attempt 1/3): fetch failed"
→ "[Collections] Fetch failed (attempt 2/3): fetch failed"
→ "[Collections] Fetch failed (attempt 3/3): fetch failed"
```

### Root Cause
This is a **direct consequence of Issue #1** (redirect loop). The frontend's SSR tries to fetch collections data from `http://nginx:80/api/v1/collections`, gets stuck in redirect loop, exhausts retries, and returns empty.

### Impact
- Collections page loads with no data
- Landing page collection section empty
- Users can't browse by category

### Fix
**Auto-fixed when Issue #1 is resolved.** No separate fix needed.

---

## Issue #5: Video Uploads Not Loading

### Severity: 🟡 HIGH

### Symptom
Products have no videos attached. All 61 products show `videos: 0`.

### Investigation
```
curl https://aaryaclothing.in/api/v1/products/browse?limit=3
→ All products: "Videos": 0
```

### Root Cause
- Video upload functionality exists in the codebase
- No products currently have videos uploaded (likely never used or upload was broken)
- Need to verify R2 video upload pipeline is working

### Impact
- Product pages missing video content
- Rich media experience broken

### Fix
1. Test video upload flow end-to-end
2. Verify R2 bucket accepts video files
3. Check video playback on product pages

---

## Issue #6: Admin Image Delete Route Mismatch

### Severity: 🟠 MEDIUM

### Symptom
```
DELETE /api/v1/admin/products/triveni-glassy-silk-suit/images/181
→ 422 Unprocessable Entity
→ Validation error: 'product_id' should be integer, got 'triveni-glassy-silk-suit'
```

### Root Cause
Admin frontend sends DELETE requests with **product slug** (`triveni-glassy-silk-suit`) but the backend route expects **product_id** (integer). Route definition: `@app.delete("/api/v1/admin/products/{product_id}/images/{image_id}")` — expects `product_id: int`.

### Impact
- Admin cannot delete product images
- Image management broken in admin dashboard
- Retries pile up (seen 6+ retry attempts per image)

### Fix
Either:
1. Change backend route to accept slug: `{product_id: str}` and resolve slug→id internally
2. Change frontend to send numeric product_id

---

## Issue #7: PgBouncer Running But Unused

### Severity: 🟠 MEDIUM (Future Scalability)

### Current State
```
PgBouncer: Running on port 6432, healthy
Services connecting to: postgres:5432 (direct)
PgBouncer connections: 0 (no services using it)
```

### Current Connection Pattern (Without PgBouncer)
| Service | Pool Size | Max Overflow | Peak Connections |
|---------|-----------|-------------|-----------------|
| core | 8 | 7 | 15 |
| commerce | 8 | 7 | 15 |
| payment | 8 | 7 | 15 |
| admin | 8 | 7 | 15 |
| **Total potential** | | | **60** |

### Current PostgreSQL Load
- Active connections: ~27
- Idle connections: ~20
- Max connections configured: 100
- **Headroom: 73 connections** (OK for now, but not scalable)

### Impact
- Works fine for current traffic (~27 connections)
- Under flash sale / traffic spike → 60+ connections → risk of hitting `max_connections=100`
- No connection queuing → requests fail instead of waiting
- Cart/inventory race conditions under concurrent load

### Fix
Enable PgBouncer:
1. Change all services `DATABASE_URL` → `pgbouncer:6432`
2. Set `DATABASE_POOL_SIZE=1`, `DATABASE_MAX_OVERFLOW=0`
3. Update SQLAlchemy pool class for transaction mode
4. 25 PgBouncer server connections serve 500+ concurrent clients

---

## Issue #8: Missing /me Endpoint in Commerce

### Severity: 🔴 CRITICAL

See [Issue #2](#issue-2-apiv1me-returns-404-profile-broken) above. This is a duplicate listing for tracking purposes.

---

## Fix Plan — Priority Order

### Phase 1: Critical Fixes (Do NOW)

| # | Fix | File(s) | Est. Impact |
|---|-----|---------|-------------|
| 1 | **Fix nginx redirect loop** — remove trailing slash redirect OR fix Host header | `docker/nginx/nginx.conf` | Fixes collections, site hanging, 38+ fetch errors |
| 2 | **Add `/api/v1/me` endpoint to commerce** OR route to core | `services/commerce/main.py` OR `docker/nginx/nginx.conf` | Fixes profile page |
| 3 | **Notify users to re-login** — add banner on site | Frontend only | Fixes cart/profile after SECRET_KEY rotation |

### Phase 2: High Priority (Today)

| # | Fix | File(s) |
|---|-----|---------|
| 4 | **Fix admin image delete route** — accept slug or change frontend to send ID | `services/admin/main.py` OR frontend |
| 5 | **Test video upload pipeline** — verify R2 video upload + playback | `services/commerce/` + frontend |
| 6 | **Enable PgBouncer** — switch all services to connection pooling | `docker-compose.yml` + all services |

### Phase 3: Maintenance (This Week)

| # | Fix | File(s) |
|---|-----|---------|
| 7 | Remove orphan `aarya_pgbouncer` container (if not enabling) | Docker |
| 8 | Add AI API keys (GROQ, OPENROUTER, etc.) for chat | `.env` |
| 9 | Set up monitoring alerts for 502/401 rates | Monitoring |

---

## Service Health Status (As of 2026-04-13 07:45 UTC)

| Service | Status | Notes |
|---------|--------|-------|
| aarya_core | ✅ healthy | Working |
| aarya_commerce | ✅ healthy | Working (missing /me endpoint) |
| aarya_payment | ✅ healthy | Working |
| aarya_admin | ✅ healthy | Working (image delete route mismatch) |
| aarya_frontend | ⚠️ running | 38 fetch failures from redirect loop |
| aarya_nginx | ✅ running | Ports 80, 443 — redirect loop bug |
| aarya_postgres | ✅ healthy | 27 active connections |
| aarya_redis | ✅ healthy | Working |
| aarya_meilisearch | ✅ healthy | Working |
| aarya_payment_worker | ✅ healthy | Working |
| aarya_pgbouncer | ✅ healthy | Running but **nobody connects to it** |
| pg_backup | ✅ healthy | Working |

---

## Git Commit History (Recent)

```
b4147e0 feat: review system with image uploads, auth flow fixes, and cart stability
b73be4f fix: eliminate all IP-based rate limiting — switch to per-customer keys
6f3083c fix: production deployment - auth flow, order idempotency, security, and scalability fixes
90ae213 chore: minor cart lock imports, redis/compose tweaks, healthcheck cleanup
0c437dc comprehensive production hardening: auth, infrastructure, performance, and security fixes
```

**Note:** The redirect loop and missing `/me` endpoint are **pre-existing bugs** — not introduced by recent commits. They've been in the codebase since the nginx routing was initially configured.

---

## Appendix: Live Testing Results

### Working Endpoints (HTTP 200)
```
GET  /                                    → 200 ✅
GET  /api/v1/health                       → 200 ✅
GET  /api/v1/products/browse?limit=1      → 200 ✅
GET  /api/v1/collections                  → 200 ✅ (external, via HTTPS)
GET  /api/v1/landing/all                  → 200 ✅
GET  /api/v1/admin/dashboard/overview     → 401 (correct — requires auth) ✅
```

### Broken Endpoints
```
GET  /api/v1/me                           → 404 ❌ (commerce doesn't implement)
GET  /api/v1/cart/items (unauthenticated) → 401 (requires login)
POST /api/v1/cart/items (unauthenticated) → 401 (requires login)
```

### Redirect Loop (Internal SSR)
```
http://nginx:80/api/v1/collections → 301 → http://nginx/api/v1/collections/
→ 307 → http://nginx/api/v1/collections → loop
```

---

*Document generated from live system analysis on 2026-04-13.*
