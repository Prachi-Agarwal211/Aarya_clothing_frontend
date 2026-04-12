# FINAL DEEP REVIEW — All Uncommitted Changes

**Date:** 2026-04-12
**Reviewer:** Lead Architect (Aarya Clothing)
**Scope:** 34 modified files + 12 untracked files (1,079 insertions, 673 deletions, 2,927 diff lines)

---

## 1. EXECUTIVE SUMMARY

### ❌ CANNOT DEPLOY SAFELY — 3 CRITICAL BLOCKERS

There are **3 critical issues** that will cause production failures, **3 warnings** to monitor post-deploy, and **8 positive improvements**. The blockers MUST be resolved before any deployment.

| Category | Count | Severity |
|----------|-------|----------|
| Critical Blockers | 3 | 🔴 Must fix before deploy |
| Warnings | 3 | 🟡 Monitor after deploy |
| Minor Issues | 2 | 🟢 Fix at convenience |
| Positive Findings | 8 | ✅ Good work |

---

## 2. CRITICAL ISSUES (BLOCKERS)

### 🔴 CRITICAL-1: Payment Webhook `rollback()` corrupts outer transaction scope

**File:** `services/payment/service/payment_service.py` — lines 640-644
**Impact:** Webhook processing failures → Razorpay retries → potential duplicate order creation or 500 errors

**The Bug:**

`_handle_payment_captured()` calls `self.db.rollback()` on line 643 as an idempotent early return. But this method is invoked from `process_webhook_event()` (line 552) which:

1. Creates a `WebhookEvent` record + `self.db.flush()` (line 536-537)
2. Calls `_handle_payment_captured()` 
3. `rollback()` inside `_handle_payment_captured` **rolls back the WebhookEvent too**
4. Back in `process_webhook_event()`, `webhook_event.processed = True` operates on a **detached instance**
5. `self.db.commit()` (line 561) raises `InvalidRequestError` → caught by outer except → another `rollback()` → **re-raises exception** → **500 response to Razorpay**

Razorpay will retry the webhook, the idempotency check finds the flushed (but rolled-back) `WebhookEvent`, returns `True` early, BUT the session is now in an inconsistent state.

**Fix (one line change):**
```python
# Line 643: REMOVE self.db.rollback()
# The session hasn't been modified yet at this point — nothing to roll back.
if transaction and transaction.status != "pending":
    logger.info(...)
    return  # ← Just return, no rollback needed
```

---

### 🔴 CRITICAL-2: PgBouncer `userlist.txt` hardcoded — password changes will break ALL services

**Files:** `docker/pgbouncer/userlist.txt` (new file), `docker-compose.yml` line 82
**Impact:** Changing `POSTGRES_PASSWORD` in `.env` breaks ALL database connections (every microservice routes through PgBouncer)

**The Bug:**

The `userlist.txt` is committed to the repo with a hardcoded MD5 hash matching the current `.env` password:
```
"postgres" "md5073181e4cded44128152085f27ef69db"
```

The `entrypoint.sh` only auto-generates this file if it doesn't exist or is empty. Since it's mounted as a read-only volume (`:ro`), the entrypoint skips generation.

**Impact chain:**
1. Developer changes `POSTGRES_PASSWORD` in `.env` for security
2. Postgres starts with new password ✅
3. PgBouncer still has old hash ❌
4. ALL 4 microservices fail to connect (DATABASE_URL → pgbouncer:6432)
5. **Complete application outage**

**Fix:**
```bash
# Delete the committed file
rm docker/pgbouncer/userlist.txt

# Add to .gitignore
echo "docker/pgbouncer/userlist.txt" >> .gitignore

# Remove the volume mount from docker-compose.yml (line 82):
#   - ./docker/pgbouncer/userlist.txt:/etc/pgbouncer/userlist.txt:ro
```

The entrypoint.sh already handles auto-generation correctly.

---

### 🔴 CRITICAL-3: Commerce service — Duplicate `/api/v1/products/browse` route registration

**Files:** `services/commerce/main.py` line 3454 (inline), `services/commerce/routes/products.py` line 435 (router), `services/commerce/main.py` line 497 (router include)
**Impact:** One browse endpoint shadows the other — unpredictable behavior if the shadowed one has different logic

**The Bug:**

Two routes register at the same path:
- **Router version** (`routes/products.py`): Registered first at line 497 via `app.include_router(products_router)`. Uses `cache.get_or_set()` with MD5-hashed cache key, 300s TTL.
- **Inline version** (`main.py` line 3454): Registered second. Uses `cache.get_or_set()` with a different cache key format, 120s TTL.

FastAPI/Starlette **allows duplicate routes** — the first one registered wins. The inline version at line 3454 is **dead code** — it will never be called.

**Why this matters:** The inline version (dead code) was the one that was carefully refactored with `_browse_products_payload()` and `asyncio.to_thread()` for thread safety. The router version in `routes/products.py` still uses the old pattern with the `db` session directly in the async function.

**Evidence — Router version (ACTIVE, line 435-493 in routes/products.py):**
```python
@router.get("/browse")
async def browse_products(
    ...
    db: Session = Depends(get_db),  # ← Uses injected db session directly in async
    ...
):
    # Uses cache.get_or_set with db session inside async context
```

**Inline version (DEAD CODE, main.py line 3454-3502):**
```python
@app.get("/api/v1/products/browse")
async def browse_products_main(...):
    # NO db dependency — creates own session in asyncio.to_thread (CORRECT)
    def _fetch_sync():
        db = SessionLocal()
        try:
            return _browse_products_payload(db, ...)
        finally:
            db.close()
```

**The active router version runs DB queries in the async event loop**, which can block the entire server under load.

**Fix:** Either:
- Remove the inline route from `main.py` (line 3391-3502) AND fix the router version to use `asyncio.to_thread()`, OR
- Remove the router's `/browse` endpoint from `routes/products.py` and keep the inline version

**Recommendation:** Remove from router, keep inline. The inline version is the correctly implemented one.

---

## 3. WARNINGS (Monitor After Deploy)

### 🟡 WARNING-1: Nginx HTTP (:80) routing parity — new routes added, verify no conflicts

**File:** `docker/nginx/nginx.conf` — lines 102-450

The HTTP server block now mirrors the HTTPS routing for many endpoints. Key additions:
- `/api/v1/me` and `/api/v1/me/` — new
- `/api/v1/checkout` — exact match (no trailing slash)
- `/api/v1/returns` — exact match + prefix
- `/api/v1/chat/rooms/mine` — regex match
- `/api/v1/staff/` — new

**Risk:** Regex location blocks (`location ~ ^/api/v1/chat/rooms...`) are evaluated BEFORE prefix blocks. If any new regex location has a bug, it could misroute traffic. The order looks correct (more specific before general), but this is the #1 source of nginx routing bugs.

**Action:** After deploy, test `curl http://nginx:80/api/v1/me` and `curl http://nginx:80/api/v1/chat/rooms/mine` from inside the Docker network.

---

### 🟡 WARNING-2: PostgreSQL `shared_buffers=4GB` on 16GB server — aggressive but acceptable

**File:** `docker-compose.yml` — lines 28-38

```yaml
shared_buffers=4GB          # 25% of RAM — standard recommendation
work_mem=64MB               # Per-operation — can multiply to many GB under load
effective_cache_size=12GB   # 75% of RAM
max_connections=50          # Reduced from 100 (good with PgBouncer)
```

**Risk:** `work_mem=64MB` means a single complex query with multiple sorts/hashes can use 64MB × operations. With 50 connections and complex queries, you could exhaust RAM. However, with PgBouncer limiting to 25 server connections (`default_pool_size=25`), the worst case is ~1.6GB for work_mem, which is fine on a 16GB server.

**Action:** Monitor `pg_stat_activity` and OOM killer after deploy.

---

### 🟡 WARNING-3: Commerce browse endpoint — `user_role` access without null guard

**File:** `services/commerce/main.py` — line 3469

```python
user_role = current_user.get("role") if current_user else None
```

This is safe. But the **router version** in `routes/products.py` at line 216:

```python
user_role = current_user.get("role") if current_user else None
```

Also safe. Both handle None correctly. No issue here — just noting that the async-to-thread refactoring in the inline version means `user_role` is captured in the closure correctly.

---

### 🟡 WARNING-4: PgBouncer `pool_mode = transaction` — requires clean transaction handling

**File:** `docker/pgbouncer/pgbouncer.ini` — line 10

With `transaction` mode, PgBouncer returns the server connection to the pool after each transaction completes. If any code holds a connection across multiple transactions without explicitly committing, it will fail.

**All services use `autocommit=False`** with explicit `db.commit()` / `db.rollback()`, which is correct. The `get_db()` FastAPI dependency calls `db.close()` in the `finally` block, which implicitly commits any pending transaction. This is fine.

**Risk:** Any `asyncio.create_task()` that uses the same session (like `_save_chat_message_async` in admin/main.py) will fail because the session is closed before the task runs. Looking at the code:

```python
# admin/main.py line 1649
asyncio.create_task(
    _save_chat_message_async(room_id, user_id, sender_type, msg_text)
)
```

And `_save_chat_message_async` creates its **own session** via `SessionLocal()`. ✅ Safe.

---

## 4. POSITIVE FINDINGS (Things Done Well)

### ✅ POSITIVE-1: Payment webhook race condition fix — `with_for_update()` row locking

The `process_webhook_event` now uses `SELECT ... FOR UPDATE` via `.with_for_update()` to serialize concurrent webhook deliveries for the same payment. This is the **correct** approach for preventing double-capture. The early-return idempotency check (status != "pending") is also correct — it just has the `rollback()` bug noted in CRITICAL-1.

### ✅ POSITIVE-2: Guest order tracking via HMAC-signed tokens

The `guest_tracking_token.py` module implements clean, stateless HMAC-SHA256 tokens. No database column needed. Proper timing-safe comparison via `hmac.compare_digest()`. URL-safe base64 encoding. **This is well-designed.**

### ✅ POSITIVE-3: Nginx routing parity between HTTP and HTTPS

The HTTP (:80) block now mirrors the HTTPS (:443) routing for paths the frontend hits via `NEXT_PUBLIC_API_URL=http://nginx:80`. This fixes the SSR/browser mismatch where landing page config went to commerce on HTTP but admin on HTTPS. **Good catch.**

### ✅ POSITIVE-4: Intro video click-to-play redesign

The `IntroVideo.jsx` component switched from autoplay (which browsers block) to a clean click-to-play model. Removed the heavy preloader animation. Simplified error handling. **Much better UX.**

### ✅ POSITIVE-5: Redis password removed from `redis.conf`

The hardcoded password was removed from `docker/redis/redis.conf` and is now passed via `--requirepass` CLI argument in docker-compose.yml. **Proper secret management.**

### ✅ POSITIVE-6: Connection pool tuning across all services

All services now have explicit `DATABASE_POOL_SIZE=10` and `DATABASE_MAX_OVERFLOW=20` in docker-compose.yml, with `pool_recycle=1800` (30 min) and `pool_timeout=30` in the engine configs. These are sensible defaults for PgBouncer transaction mode.

### ✅ POSITIVE-7: Frontend middleware token fallback logic

The middleware.js now falls back to `refresh_token` when `access_token` is expired, preventing redirect loops during the brief window before client-side token refresh runs. **Good UX improvement.**

### ✅ POSITIVE-8: Node.js 18 → 20 upgrade

`frontend_new/Dockerfile` updated from `node:18-alpine` to `node:20-alpine`. Node 18 reaches EOL in April 2025. **Necessary and timely.**

---

## 5. FILE-BY-FILE ANALYSIS

### `docker-compose.yml` (144 lines changed)
| Line Range | Change | Status |
|-----------|--------|--------|
| 28-38 | Postgres tuned for 16GB RAM | ✅ Good |
| 71-98 | PgBouncer service added | ⚠️ userlist.txt issue (CRITICAL-2) |
| 106-112 | Redis `--requirepass` CLI | ✅ Good |
| 172+ | All services → pgbouncer:6432 | ⚠️ Depends on CRITICAL-2 fix |
| Memory limits increased (512M→768M/1G/6G) | Appropriate for 16GB server | ✅ Good |
| Ports → expose (security hardening) | Services no longer exposed to host | ✅ Good |

### `docker/nginx/nginx.conf` (277 lines changed)
| Line Range | Change | Status |
|-----------|--------|--------|
| 13-16 | worker_processes auto, rlimit 65535 | ✅ Good |
| 29-32 | open_file_cache for static files | ✅ Good |
| 43-49 | SSL optimization settings | ✅ Good |
| 67-71 | `public_read` rate limit zone | ✅ Good |
| 102+ | HTTP block mirrors HTTPS routing | ✅ Good, but test after deploy |
| 111-125 | WebSocket locations (admin + customer) | ✅ Correct proxy headers |
| 128-139 | SSE for order events | ✅ Buffering off correct |
| 142-151 | Internal service auth (IP allow) | ✅ Good |
| 454+ | Chat routing: customer→commerce, staff→admin | ✅ Correct split |
| `limit_req` on all API locations | Good for DoS protection | ✅ Good |

### `docker/redis/redis.conf` (11 lines changed)
| Change | Status |
|--------|--------|
| Password removed from config file | ✅ Good |
| maxmemory 200mb → 400mb | ✅ Appropriate |
| Policy volatile-lru with comment | ✅ Safer for mixed workloads |

### `services/commerce/main.py` (142 lines changed)
| Line Range | Change | Status |
|-----------|--------|--------|
| 1740-1790 | Guest order tracking endpoint | ✅ Well implemented |
| 3391-3452 | `_browse_products_payload` extraction | ✅ Clean refactoring |
| 3454-3502 | Inline browse with caching + asyncio.to_thread | ✅ Correct async pattern |
| 3454 | `regex=` in Query — deprecated in Pydantic v2 | 🟡 See MINOR-1 |

### `services/commerce/routes/products.py` (438 lines changed — major refactor)
| Line Range | Change | Status |
|-----------|--------|--------|
| 175-178 | New fields: tags, material, care_instructions | ✅ Good |
| 216+ | `list_products` wrapped in `cache.get_or_set` | ✅ Good |
| 222 | `cache_key` includes all query params | ✅ Correct cache key |
| 435-493 | `/browse` route (DUPLICATE — see CRITICAL-3) | 🔴 Dead code / wrong implementation |

### `services/commerce/schemas/order.py` (21 lines added)
| Change | Status |
|--------|--------|
| `GuestOrderTrackItem` schema | ✅ Minimal fields for public view |
| `GuestOrderTrackResponse` schema | ✅ Clean design |

### `services/commerce/service/guest_tracking_token.py` (new file)
| Change | Status |
|--------|--------|
| HMAC-SHA256 token creation | ✅ Correct |
| Timing-safe comparison | ✅ `hmac.compare_digest` used |
| Base64 URL-safe encoding | ✅ Correct |

### `services/commerce/service/core_notification_client.py` (23 lines changed)
- Minor cleanup, no issues found. ✅

### `services/commerce/core/advanced_cache.py` (11 lines changed)
- Simplified pattern invalidation to use `self.redis.invalidate_pattern()`. ✅ Cleaner.

### `services/core/service/email_queue.py` (80 lines changed)
| Change | Status |
|--------|--------|
| Async Redis client for BLPOP | ✅ Correct — sync blpop can break under load |
| Exponential backoff retry | ✅ Good (max 30s delay) |
| `aclose()` on error/reconnect | ✅ Proper cleanup |
| `CancelledError` handling | ✅ Graceful shutdown |

### `services/core/main.py` (9 lines changed)
- Email queue worker started in lifespan, cancelled on shutdown. ✅ Correct lifecycle management.

### `services/payment/service/payment_service.py` (38 lines changed)
| Change | Status |
|--------|--------|
| `with_for_update()` row locking | ✅ Correct approach |
| Early return with `rollback()` | 🔴 BUG — see CRITICAL-1 |
| Idempotency for already-processed | ✅ Logic correct, implementation flawed |

### `shared/base_config.py` (8 lines changed)
| Change | Status |
|--------|--------|
| `pool_recycle=1800` (was 3600) | ✅ Better for PgBouncer |
| `pool_timeout=30` | ✅ Prevents infinite waits |

### All Dockerfiles (admin, commerce, core, payment)
| Change | Status |
|--------|--------|
| `UVICORN_WORKERS=3` env var | ✅ Good default |
| `CMD ["sh", "-c", "exec uvicorn ..."]` | ✅ Proper exec form |
| Commerce: was `python main.py`, now `uvicorn main:app` | ✅ Consistent |

### `frontend_new/middleware.js` (41 lines changed)
| Change | Status |
|--------|--------|
| Token fallback (access → refresh) | ✅ Good |
| Null-safe `decodedToken?.sub` | ✅ Fixed potential crash |
| `/orders/track` excluded from protected | ✅ Correct for guest tracking |

### `frontend_new/components/landing/IntroVideo.jsx` (337 lines → net -140 lines)
- Click-to-play redesign, removed autoplay, removed preloader animation.
- `preload="auto"` instead of `preload="metadata"` — will download more data upfront but starts playback faster. Trade-off is acceptable for an intro video.
- `IntroVideoOverlayContext` integration to hide bottom nav during video. ✅ Good.

### `frontend_new/app/collections/[slug]/page.js` (19 lines added)
- `isInvalidCollectionSlug()` guard prevents crashes from null/undefined slugs. ✅ Good defensive coding.

### `frontend_new/lib/baseApi.js` (20 lines changed)
- Documentation updated to clarify this is the nginx gateway URL, not just core service. ✅ Good clarification.

### `frontend_new/lib/performance.js` (2 lines changed)
- Added `import React from 'react'` but no React APIs are used in this file. 🟡 Unnecessary import (MINOR-2).

---

## 6. MINOR ISSUES

### 🟢 MINOR-1: `regex=` deprecated in FastAPI/Pydantic v2

**Files:** `services/commerce/main.py` line 3460, `services/commerce/routes/products.py` line 441

```python
sort_by: str = Query("newest", regex="^(newest|price_low|price_high|popular|name_asc|name_desc)$")
```

In Pydantic v2 / FastAPI 0.109+, `regex` is deprecated in favor of `pattern`. This works but will produce deprecation warnings in logs.

**Fix:** Replace `regex=` with `pattern=`.

### 🟢 MINOR-2: Unused `import React` in `performance.js`

**File:** `frontend_new/lib/performance.js` line 11

```javascript
import React from 'react';
```

No React APIs are used in this file (it contains utility functions like debounce, throttle, etc.). This is dead code.

**Fix:** Remove the import.

---

## 7. RECOMMENDATIONS (Non-blocking improvements)

### 1. Add PgBouncer health to docker-compose `depends_on` chains

Currently, services `depends_on: postgres` but should `depends_on: pgbouncer`. If PgBouncer is slow to start, services will fail to connect. Consider:

```yaml
depends_on:
  pgbouncer:
    condition: service_healthy
```

### 2. Add PgBouncer monitoring endpoint

PgBouncer supports an admin database on a separate port. Expose it for monitoring:
```
admin_users = postgres
stats_users = postgres
```
Already configured in pgbouncer.ini. Consider adding a healthcheck that queries `SHOW POOLS`.

### 3. Commerce `/api/v1/products/browse` — resolve the duplicate

See CRITICAL-3. This is the most impactful cleanup because the router version runs DB queries in the async event loop.

### 4. Add `.gitignore` entry for `docker/pgbouncer/userlist.txt`

See CRITICAL-2. This file should never be in version control.

### 5. Consider `DATABASE_POOL_SIZE=5` for PgBouncer transaction mode

Current service config: `DATABASE_POOL_SIZE=10`, `DATABASE_MAX_OVERFLOW=20`. With PgBouncer `default_pool_size=25`, 4 services × 10 = 40 potential connections but PgBouncer only has 25 server connections. This means 15 connections will queue. 

**Recommendation:** Set `DATABASE_POOL_SIZE=5` and `DATABASE_MAX_OVERFLOW=5` per service (total 4×10=40 client connections, but PgBouncer multiplexes to 25 server connections). The current values work but are over-provisioned.

---

## 8. UNTRACKED FILES REVIEW

| File | Purpose | Integration Status |
|------|---------|-------------------|
| `docker/pgbouncer/*` (5 files) | PgBouncer connection pooler | ⚠️ userlist.txt must NOT be committed |
| `docker/postgres/scale_indexes.sql` | Index optimization | Needs to be mounted in docker-compose (✅ it is, line 37) |
| `frontend_new/lib/introVideoOverlayContext.jsx` | Context for video overlay visibility | ✅ Used by BottomNavigation, ChatWidget, IntroVideo |
| `services/commerce/service/guest_tracking_token.py` | HMAC token for guest order tracking | ✅ Integrated in main.py |
| `scripts/healthcheck.sh` | Health check script | Not referenced in docker-compose — needs integration |
| `scripts/setup-swap.sh` | Swap file setup | Utility script, not auto-executed |
| `update_env_secure.sh` | Environment variable updater | Utility script |
| `*.md` (various reports) | Documentation | No integration impact |

---

## 9. DEPLOYMENT READINESS CHECKLIST

| Check | Status | Notes |
|-------|--------|-------|
| Docker Compose valid YAML | ✅ | No syntax errors |
| All services have healthchecks | ✅ | Postgres, Redis, PgBouncer, Meilisearch, all services |
| Network isolation (backend/frontend) | ✅ | Properly configured |
| Resource limits set | ✅ | Appropriate for 16GB server |
| Secrets not hardcoded (except userlist.txt) | 🔴 | See CRITICAL-2 |
| Route conflicts | 🔴 | See CRITICAL-3 |
| Transaction safety | 🔴 | See CRITICAL-1 |
| Cache strategy consistent | ✅ | L1+L2 caching with proper invalidation |
| Rate limiting configured | ✅ | Per-zone limits with burst |
| SSL configured | ✅ | TLSv1.2+1.3, session caching |
| PgBouncer auth matches Postgres | ✅ | MD5 hash verified |
| Node version current | ✅ | Node 20 LTS |

---

## 10. FIX PRIORITY ORDER

1. **CRITICAL-1:** Remove `self.db.rollback()` in `_handle_payment_captured` — 1 line fix, 5 min
2. **CRITICAL-2:** Delete `userlist.txt`, add to `.gitignore`, remove volume mount — 3 changes, 5 min
3. **CRITICAL-3:** Remove duplicate browse route — pick one, delete the other — 10 min
4. **MINOR-1:** Replace `regex=` with `pattern=` — 2 occurrences, 2 min
5. **MINOR-2:** Remove unused React import — 1 line, 1 min

**Total fix time: ~25 minutes. Then safe to deploy.**
