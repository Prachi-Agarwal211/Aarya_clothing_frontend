# Aarya Clothing — Production Scaling Master Plan

> **Date:** April 12, 2026
> **VPS:** AMD EPYC 9354P (4 vCPUs / 32-core host), 16GB RAM, 193GB SSD (15% used)
> **Current Traffic:** ~36 req/min peak, ~2.6 req/sec average
> **Target:** Handle 500+ concurrent users (2000+ req/min) on this single VPS
> **Status:** 10 containers running, several critical bugs, no horizontal scaling

---

## 1. VPS CAPACITY ANALYSIS

### 1.1 Current Hardware

| Resource | Available | Used | Free | Utilization |
|----------|-----------|------|------|-------------|
| **CPU** | 4 vCPUs (EPYC 9354P, 32-core host shared) | ~0.86 load avg | 3+ cores | 21% |
| **RAM** | 15.6 GB | 8.0 GB | 7.6 GB | 51% |
| **Disk** | 193 GB | 28 GB | 166 GB | 15% |
| **Swap** | 0 GB | 0 GB | — | N/A |

### 1.2 Container Resource Breakdown

| Container | CPU | Memory | Limit | % of Limit | Status |
|-----------|-----|--------|-------|------------|--------|
| Frontend (Next.js) | 0.00% | 93 MB | **NONE** | — | ⚠️ No limit set |
| Commerce (Python) | 0.14% | 108 MB | 512 MB | 21% | ✅ |
| Core (Python) | 0.15% | 77 MB | 512 MB | 15% | ✅ |
| Admin (Python) | 3.90% | 114 MB | 512 MB | 22% | ✅ |
| Payment (Python) | 0.15% | 78 MB | 512 MB | 15% | ✅ |
| Payment Worker | 0.06% | 22 MB | 256 MB | 9% | ✅ |
| PostgreSQL | 0.06% | 65 MB | 512 MB | 13% | ✅ |
| Redis | 0.37% | 14 MB | 256 MB | 5% | ✅ |
| Meilisearch | 0.08% | 28 MB | 512 MB | 5% | ✅ |
| Nginx | 0.00% | 5 MB | 128 MB | 4% | ✅ |
| **Total** | **~5%** | **~604 MB** | **4.1 GB** | **15%** | |

### 1.3 Headroom Analysis

| Resource | Current Usage | Max Safe Usage (80%) | Headroom | Scale Factor |
|----------|--------------|---------------------|----------|--------------|
| **CPU** | 0.86 / 4.0 | 3.2 cores | 2.34 cores free | **3.7x current load** |
| **RAM** | 8.0 / 15.6 GB | 12.5 GB | 4.5 GB free | **1.6x current** |
| **Disk** | 28 / 193 GB | 154 GB | 126 GB free | **5.5x current** |

### 1.4 Bottleneck Prediction

**RAM is the first bottleneck** (51% used, only 4.5 GB headroom to 80%). After that, CPU. Disk has massive headroom.

**To handle 2000+ req/min on this VPS, we need to:**
1. Increase per-service memory limits (currently very conservative)
2. Add CPU workers (4 vCPUs = 4-8 Python workers total)
3. Add PgBouncer (reduces per-connection memory)
4. Add swap as safety net (4 GB swap file)

---

## 2. CURRENT ARCHITECTURE PROBLEMS

### 2.1 Critical: OTP Email System Broken

**File:** `services/core/service/email_queue.py`
**Symptom:** `send-verification-otp` returns HTTP 500. Users cannot register.
**Root Cause:** The `run_otp_email_worker()` uses a synchronous Redis `blpop()` wrapped in `asyncio.to_thread()`. When the Redis socket times out (happens under load or brief network blips), the exception corrupts the Redis client's connection state. Every subsequent `blpop` call fails immediately.

**Impact:** Every registration that uses email OTP → 500 error. Complete registration failure for new users.

**The death spiral:**
```
1. Worker calls redis_sync.blpop(queue, 5) via asyncio.to_thread()
2. Redis socket times out (normal under load)
3. Exception caught, logged, loop continues
4. BUT: the Redis client's internal connection is now in broken state
5. Next blpop() call → immediate timeout → repeat forever
```

**Fix — Replace with async Redis + reconnection:**

```python
# services/core/service/email_queue.py — REPLACE run_otp_email_worker()
async def run_otp_email_worker() -> None:
    """Background task: BLPOP jobs and send OTP emails — with async Redis."""
    import redis.asyncio as aioredis
    from service.email_service import email_service
    from core.config import settings

    logger.info("[EmailQueue] OTP email worker starting (async mode)")

    # Create dedicated async Redis connection for the worker
    r = None
    max_retries = 0
    while True:
        try:
            if r is None:
                r = aioredis.from_url(
                    settings.REDIS_URL.replace("redis://", "redis://:"),
                    db=settings.REDIS_DB,
                    decode_responses=True,
                    retry_on_timeout=True,
                    socket_keepalive=True,
                    socket_connect_timeout=10,
                    retry=aioredis.retry.Retry(
                        backoff=aioredis.retry.ExponentialBackoff(),
                        retries=3
                    ),
                )

            # Use async BLPOP with timeout
            result = await r.blpop(OTP_EMAIL_QUEUE_KEY, timeout=5)
            if result is None:
                continue

            _, raw = result
            data = json.loads(raw)
            to_email = data.get("to")
            code = data.get("code")
            purpose = data.get("purpose", "verification")

            if not to_email or not code:
                logger.error("[EmailQueue] bad payload: %s", raw)
                continue

            ok = email_service.send_otp_email(to_email, code, purpose)
            if not ok:
                logger.error("[EmailQueue] SMTP failed for %s", to_email)

            max_retries = 0  # Reset on success

        except asyncio.CancelledError:
            logger.info("[EmailQueue] worker cancelled")
            if r:
                await r.aclose()
            raise
        except Exception as e:
            max_retries += 1
            logger.exception("[EmailQueue] worker error (retry %d): %s", max_retries, e)
            # Reset connection on error
            if r:
                try:
                    await r.aclose()
                except Exception:
                    pass
                r = None
            # Exponential backoff: 1s, 2s, 4s, 8s, max 30s
            delay = min(2 ** max_retries, 30)
            await asyncio.sleep(delay)
```

### 2.2 Critical: All Services Run Single-Threaded

**Files:** `services/commerce/main.py`, `services/core/main.py`, `services/payment/main.py`

**Problem:** Every service runs `uvicorn.run("main:app", ...)` with default `workers=1`. One request blocks all others.

**Current throughput:** ~10-20 concurrent requests per service max.

**Fix — Add workers to every service's `__main__` block:**

```python
# commerce/main.py, core/main.py, payment/main.py — change __main__ to:
if __name__ == "__main__":
    import multiprocessing
    import uvicorn

    workers = min(multiprocessing.cpu_count(), 4)  # Cap at 4 workers
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5002,  # change per service
        workers=workers,
        log_level=settings.LOG_LEVEL.lower(),
        # NO reload in production
    )
```

**Dockerfile CMD changes:**

```dockerfile
# services/commerce/Dockerfile — change last line:
CMD ["python", "-c", "import multiprocessing, uvicorn; workers=min(multiprocessing.cpu_count(),4); uvicorn.run('main:app', host='0.0.0.0', port=5002, workers=workers, log_level='info')"]
```

**OR simpler — use uvicorn CLI in Dockerfile:**

```dockerfile
# All service Dockerfiles — change CMD:
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5002", "--workers", "4", "--log-level", "info"]
```

### 2.3 Critical: No Frontend Resource Limits

**File:** `docker-compose.yml` — `frontend` service has no `deploy.resources.limits`.

**Risk:** Next.js SSR under load can consume 2-4 GB. Without a limit, it can OOM the host.

**Fix:**

```yaml
frontend:
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: '1.5'
      reservations:
        memory: 512M
        cpus: '0.5'
```

### 2.4 Critical: No PgBouncer — Direct DB Connections

**Current setup:**
- Postgres `max_connections=100`
- Each service: `pool_size=10, max_overflow=20` = up to 30 connections each
- 4 services × 30 = 120 connections potential, but only 100 allowed
- Under load, services compete for connections → queueing → timeouts

**Fix — Add PgBouncer:**

```yaml
# docker-compose.yml — add before postgres service:
  pgbouncer:
    image: edoburu/pgbouncer:1.21.0
    container_name: aarya_pgbouncer
    environment:
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD:-postgres123}@postgres:5432/aarya_clothing
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=500
      - DEFAULT_POOL_SIZE=25
      - MIN_POOL_SIZE=5
      - RESERVE_POOL_SIZE=10
      - ADMIN_USERS=postgres
      - AUTH_TYPE=scram-sha-256
      - AUTH_FILE=/etc/pgbouncer/userlist.txt
    ports:
      - "6005:6432"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - backend_network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: '0.25'
    volumes:
      - ./docker/pgbouncer/userlist.txt:/etc/pgbouncer/userlist.txt:ro
```

**Then update all services' DATABASE_URL:**

```yaml
# All services — change DATABASE_URL:
- DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD:-postgres123}@pgbouncer:6432/aarya_clothing
```

**And reduce pool sizes (PgBouncer does the pooling):**

```python
# shared/base_config.py — change defaults:
DATABASE_POOL_SIZE: int = 5       # was 10
DATABASE_MAX_OVERFLOW: int = 10   # was 20
```

### 2.5 Critical: Nginx Rate Limiting Defined But Not Applied

**File:** `docker/nginx/nginx.conf`

**Problem:** Zones defined but never enforced:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;
```

**Fix — Add `limit_req` to location blocks:**

```nginx
# API routes — add to each API location block:
location /api/v1/products/ {
    limit_req zone=api burst=100 nodelay;
    proxy_pass http://$commerce_backend;
    ...
}

# Auth routes — stricter limits:
location /api/v1/auth/login {
    limit_req zone=login burst=20 nodelay;
    limit_req_status 429;
    proxy_pass http://$core_backend;
    ...
}

# Registration:
location /api/v1/auth/register {
    limit_req zone=login burst=10 nodelay;
    limit_req_status 429;
    proxy_pass http://$core_backend;
    ...
}
```

### 2.6 Critical: Nginx Proxy Timeouts Too Aggressive

**Current:**
```nginx
proxy_connect_timeout 5s;
proxy_read_timeout 30s;
```

**Under load or during deployments, 5s connect timeout causes 502 errors.**

**Fix:**
```nginx
# Default timeouts (for most API routes)
proxy_connect_timeout 10s;
proxy_send_timeout 30s;
proxy_read_timeout 60s;

# For long-running routes (SSE, WebSocket, file upload)
location ~ ^/api/v1/orders/\d+/events$ {
    proxy_read_timeout 86400;
    proxy_connect_timeout 10s;
    ...
}
```

---

## 3. DATABASE OPTIMIZATION

### 3.1 Postgres Configuration Tuning

**Current Postgres config (in docker-compose.yml):**
```
shared_buffers=128MB
work_mem=8MB
effective_cache_size=256MB
max_connections=100
```

**These are too low for a 16GB VPS.** With PgBouncer handling connection pooling, we can optimize for throughput.

**Optimized config (with PgBouncer):**
```yaml
postgres:
  command: >
    postgres
    -c shared_buffers=512MB
    -c work_mem=16MB
    -c effective_cache_size=2GB
    -c maintenance_work_mem=256MB
    -c max_connections=500
    -c random_page_cost=1.1
    -c checkpoint_completion_target=0.9
    -c wal_buffers=16MB
    -c default_statistics_target=200
    -c effective_io_concurrency=200
    -c max_worker_processes=4
    -c max_parallel_workers_per_gather=2
    -c max_parallel_workers=4
```

### 3.2 Missing Database Indexes

**Current:** Good indexes on products, collections, users.

**Missing critical indexes:**

```sql
-- Add these indexes for common query patterns:

-- Order history (user listing their orders)
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);

-- Admin order listing by status
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- Cart reservation reconciliation (currently scans full table)
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_reserved ON inventory(reserved_quantity) WHERE reserved_quantity > 0;

-- Order items lookup
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Payment transaction lookup
CREATE INDEX IF NOT EXISTS idx_payments_user ON payment_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_transactions(status, created_at DESC);

-- Reviews for product pages
CREATE INDEX IF NOT EXISTS idx_reviews_product_approved ON reviews(product_id, is_approved, created_at DESC);

-- Wishlist batch check
CREATE INDEX IF NOT EXISTS idx_wishlist_user_product ON wishlist(user_id, product_id);
```

### 3.3 Database Connection Pool Configuration

**File:** `services/core/database/database.py`

```python
# Current (too aggressive for direct connections, fine with PgBouncer):
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=DATABASE_POOL_SIZE,      # default 10
    max_overflow=DATABASE_MAX_OVERFLOW, # default 20
    pool_pre_ping=True,
    pool_recycle=3600,
)

# With PgBouncer, reduce to:
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,           # Reduced — PgBouncer pools connections
    max_overflow=10,       # Reduced
    pool_pre_ping=True,
    pool_recycle=1800,     # 30 min — PgBouncer handles stale connections
    pool_timeout=10,       # Add timeout — fail fast if pool exhausted
)
```

### 3.4 Database Statistics

| Table | Rows | Size | Notes |
|-------|------|------|-------|
| users | 305 | 368 KB | ✅ Small |
| products | 62 | 632 KB | ✅ Small |
| inventory | 278 | 312 KB | ✅ Small |
| stock_reservations | 203 | 184 KB | ⚠️ Needs cleanup (stale reservations) |
| product_images | 181 | 112 KB | ✅ Small |
| orders | 10 | 288 KB | ✅ Tiny — will grow |
| payment_transactions | 33 | 304 KB | ✅ Small |
| webhook_events | 123 | 312 KB | ⚠️ Needs TTL/cleanup |

**Total DB size: 15 MB** — extremely small. Database is NOT a bottleneck.

---

## 4. REDIS OPTIMIZATION

### 4.1 Current Redis Status

| Metric | Value | Assessment |
|--------|-------|------------|
| Memory Used | 8.47 MB / 200 MB | 4% used — massive headroom |
| Peak Memory | 8.74 MB | Very low |
| Connected Clients | 20 | Normal |
| Blocked Clients | 2 | OTP email workers (expected) |
| Pub/Sub Clients | 1 | Event bus (expected) |
| Keyspace Hits | 1,572 | — |
| Keyspace Misses | 2,356 | — |
| **Hit Rate** | **40%** | ⚠️ Low — should be 70%+ |
| Evicted Keys | 0 | ✅ No pressure |
| Expired Keys | 1,152 | ✅ TTL working |
| Total Connections | 34,805 | Normal for uptime |
| Rejected Connections | 0 | ✅ No overload |

### 4.2 Redis Issues Found

**Issue 1: Low cache hit rate (40%)**

Most cache misses come from endpoints that don't cache:
- `/api/v1/products/browse` — no caching
- `/api/v1/products/slug/{slug}` — no caching
- `/api/v1/products/{id}/related` — no caching

**Fix:** Add caching to product endpoints (see Section 6).

**Issue 2: `volatile-lru` eviction policy**

```
maxmemory-policy volatile-lru
```

This only evicts keys WITH a TTL. Any key accidentally set without TTL will never be evicted → memory fills up → writes fail.

**Fix:** Change to `allkeys-lru`:

```
# docker/redis/redis.conf — change:
maxmemory-policy allkeys-lru
```

**Issue 3: Redis config file has hardcoded password**

```
requirepass 7v_CnHVZO97-fvFu9p8yNPHUAxrDb4puqcY662tTohs
```

This password is also in the `docker-compose.yml` as default. Both should use `${REDIS_PASSWORD}` variable.

---

## 5. NGINX OPTIMIZATION

### 5.1 Current Nginx Config Issues

| Issue | Current | Recommended |
|-------|---------|-------------|
| Worker processes | auto (1 in container) | auto (use all CPUs) |
| Worker connections | 1024 | 4096 |
| Rate limiting | Defined but NOT applied | Apply to all API routes |
| Connect timeout | 5s | 10s |
| Read timeout | 30s | 60s |
| No access logging rotation | Yes | Add log rotation |
| No gzip for JSON | Yes | Add application/json to gzip_types |

### 5.2 Nginx Worker Configuration

**File:** `docker/nginx/nginx.conf`

```nginx
# At top of file — use all available CPUs:
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    multi_accept on;
    use epoll;
}

http {
    # ... existing settings ...

    # Increase open file limit
    worker_rlimit_nofile 65535;

    # Add Brotli compression if available (30% smaller than gzip)
    # Or at minimum, ensure gzip covers JSON:
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Connection queue for backlog
    listen 80 backlog=4096;
    listen 443 ssl backlog=4096;
}
```

### 5.3 Block External Postgres Access

Port 6001 (Postgres) is exposed to the internet. This is why we see 687 auth failures — external scanners are probing it.

**Fix:** Remove the port mapping for production, or add a firewall rule.

```yaml
# docker-compose.yml — postgres section:
# REMOVE or COMMENT OUT for production:
# ports:
#   - "6001:5432"

# Only expose to internal network:
expose:
  - "5432"
```

---

## 6. APPLICATION-LEVEL CACHING STRATEGY

### 6.1 What Should Be Cached (Commerce Service)

| Endpoint | Cache TTL | Cache Key | Strategy |
|----------|-----------|-----------|----------|
| `GET /api/v1/products/browse` | 2 min | URL query params | Redis cache |
| `GET /api/v1/products/slug/{slug}` | 5 min | slug | Redis cache |
| `GET /api/v1/products/{id}` | 5 min | product_id | Redis cache |
| `GET /api/v1/products/{id}/related` | 5 min | product_id | Redis cache |
| `GET /api/v1/products/{id}/reviews` | 1 min | product_id | Redis cache |
| `GET /api/v1/collections` | 5 min | params | ✅ Already cached |
| `GET /api/v1/collections/slug/{slug}` | 5 min | slug | Add cache |
| `GET /api/v1/landing/all` | 10 min | — | Add cache |
| `GET /api/v1/site/config` | 30 min | — | Add cache |

### 6.2 What Should NOT Be Cached

| Endpoint | Reason |
|----------|--------|
| `POST /api/v1/cart/*` | User-specific, real-time |
| `POST /api/v1/orders` | Must be consistent |
| `GET /api/v1/orders` | User-specific |
| `POST /api/v1/auth/*` | Security-sensitive |
| `GET /api/v1/wishlist` | User-specific |

### 6.3 Implementation — Add Caching to Product Browse

**File:** `services/commerce/main.py` — in the product browse endpoint:

```python
@app.get("/api/v1/products/browse", tags=["Products"])
async def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100),  # Cap at 100
    sort: str = Query("created_at"),
    order: str = Query("desc"),
    category_id: Optional[int] = None,
    collection_id: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List/browse products with Redis caching."""

    # Build cache key from all query params
    cache_key = (
        f"products:browse:p{page}:l{limit}:s{sort}:o{order}"
        f":cat{category_id}:col{collection_id}"
        f":min{min_price}:max{max_price}:q{search}"
    )

    async def fetch_products():
        # ... existing query logic ...
        pass

    # Cache for 2 minutes
    return await cache.get_or_set(cache_key, fetch_products, ttl=120)
```

---

## 7. FRONTEND FIXES

### 7.1 Fix Null Slug in Collection Requests

**Symptom:** `/api/v1/collections/slug/null` returning 404.

**Where to look:** Frontend collection page components that pass undefined/null slug.

**Fix:** Add guard before API call:

```javascript
// In the collection page component (find in frontend_new/app/collections/[slug]/)
if (!slug || slug === 'null' || slug === 'undefined') {
    return notFound(); // or redirect to /collections
}
```

### 7.2 Fix Server Action Mismatch Errors

**Symptom:** `Failed to find Server Action "x"` — stale deployment JavaScript.

**Root cause:** Users who loaded the page before a deployment have old JS referencing server actions that no longer exist.

**Fix — Add deployment version header:**

1. Add a `BUILD_ID` env var during deployment:
```yaml
frontend:
  environment:
    - BUILD_ID=${BUILD_ID:-$(date +%s)}
```

2. Add a meta tag to the layout:
```html
<meta name="x-build-id" content="{{BUILD_ID}}" />
```

3. Add client-side check in `_app.js` or layout:
```javascript
// If build ID mismatches, force reload
useEffect(() => {
    const metaBuildId = document.querySelector('meta[name="x-build-id"]')?.content;
    if (metaBuildId && window.__NEXT_BUILD_ID && metaBuildId !== window.__NEXT_BUILD_ID) {
        window.location.reload();
    }
}, []);
```

### 7.3 Add Frontend Request Timeouts

**File:** `frontend_new/lib/baseApi.js`

Currently, the API client likely has no timeout. Under load, requests hang forever.

**Fix — Add AbortController with timeout:**

```javascript
// In BaseApiClient.fetch():
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

try {
    const response = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timeout);
    return response.json();
} catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
    }
    throw err;
}
```

### 7.4 Frontend Error Boundaries

Ensure all pages have React error boundaries so one broken component doesn't crash the entire page.

---

## 8. DOCKER-COMPOSE.OPTIMIZED.YML

Here is the complete optimized `docker-compose.yml`:

```yaml
# Aarya Clothing — Optimized Docker Compose for Production
# VPS: 4 vCPUs, 16GB RAM, 200GB SSD
# Target: 500+ concurrent users

services:
  # ============================================================
  # DATABASE LAYER
  # ============================================================

  postgres:
    image: pgvector/pgvector:pg15
    container_name: aarya_postgres
    command: >
      postgres
      -c shared_buffers=512MB
      -c work_mem=16MB
      -c effective_cache_size=2GB
      -c maintenance_work_mem=256MB
      -c max_connections=500
      -c random_page_cost=1.1
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=200
      -c effective_io_concurrency=200
      -c max_worker_processes=4
      -c max_parallel_workers_per_gather=2
      -c max_parallel_workers=4
    environment:
      POSTGRES_DB: aarya_clothing
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    expose:
      - "5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d aarya_clothing"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.5'
        reservations:
          memory: 512M
          cpus: '0.5'
    networks:
      - backend_network
    restart: unless-stopped

  # ============================================================
  # PGBOUNCER — Connection Pooling
  # ============================================================

  pgbouncer:
    image: edoburu/pgbouncer:1.21.0
    container_name: aarya_pgbouncer
    environment:
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/aarya_clothing
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=500
      - DEFAULT_POOL_SIZE=25
      - MIN_POOL_SIZE=5
      - RESERVE_POOL_SIZE=10
      - AUTH_TYPE=scram-sha-256
      - AUTH_FILE=/etc/pgbouncer/userlist.txt
    expose:
      - "6432"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h localhost -p 6432 -U postgres"]
      interval: 10s
      timeout: 3s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: '0.25'
    networks:
      - backend_network
    restart: unless-stopped
    volumes:
      - ./docker/pgbouncer/userlist.txt:/etc/pgbouncer/userlist.txt:ro

  # ============================================================
  # CACHE & MESSAGE QUEUE
  # ============================================================

  redis:
    image: redis:7-alpine
    container_name: aarya_redis
    command: redis-server /etc/redis/redis.conf
    expose:
      - "6379"
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
      - ./docker/redis/redis.conf:/etc/redis/redis.conf:ro
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 64M
    networks:
      - backend_network
    restart: unless-stopped

  # ============================================================
  # FULL-TEXT SEARCH
  # ============================================================

  meilisearch:
    image: getmeili/meilisearch:v1.6
    container_name: aarya_meilisearch
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY}
      - MEILI_ENV=production
      - MEILI_DB_PATH=/meili_data
    expose:
      - "7700"
    volumes:
      - meilisearch_data:/meili_data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7700/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    networks:
      - backend_network
    restart: unless-stopped

  # ============================================================
  # CORE PLATFORM SERVICE (Port 5001) — 4 WORKERS
  # ============================================================

  core:
    build:
      context: .
      dockerfile: services/core/Dockerfile
    container_name: aarya_core
    env_file:
      - .env
    environment:
      - SERVICE_NAME=core
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@pgbouncer:6432/aarya_clothing
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - REDIS_DB=0
      - SECRET_KEY=${SECRET_KEY}
      - ALGORITHM=HS256
      - ACCESS_TOKEN_EXPIRE_MINUTES=30
      - REFRESH_TOKEN_EXPIRE_MINUTES=1440
      - SESSION_EXPIRE_MINUTES=1440
      - ALLOWED_ORIGINS=["https://aaryaclothing.in","https://www.aaryaclothing.in"]
      - DEBUG=false
      - LOG_LEVEL=WARNING
      - INTERNAL_SERVICE_SECRET=${INTERNAL_SERVICE_SECRET}
      - PASSWORD_MIN_LENGTH=8
      - PASSWORD_REQUIRE_UPPERCASE=true
      - PASSWORD_REQUIRE_LOWERCASE=true
      - PASSWORD_REQUIRE_NUMBER=true
      - PASSWORD_REQUIRE_SPECIAL=false
      - LOGIN_RATE_LIMIT=5
      - LOGIN_RATE_WINDOW=300
      - MAX_LOGIN_ATTEMPTS=5
      - ACCOUNT_LOCKOUT_MINUTES=30
      - COOKIE_SECURE=true
      - COOKIE_HTTPONLY=true
      - COOKIE_SAMESITE=lax
      - MSG91_AUTH_KEY=${MSG91_AUTH_KEY:-}
      - MSG91_TEMPLATE_ID=${MSG91_TEMPLATE_ID:-}
      - MSG91_SENDER_ID=${MSG91_SENDER_ID:-}
      - MSG91_ORDER_FLOW_TEMPLATE_ID=${MSG91_ORDER_FLOW_TEMPLATE_ID:-}
      - SMTP_HOST=smtp.hostinger.com
      - SMTP_PORT=465
      - SMTP_USER=noreply@aaryaclothing.in
      - SMTP_PASSWORD=${SMTP_PASSWORD}
      - SMTP_TLS=true
      - EMAIL_FROM=noreply@aaryaclothing.in
      - EMAIL_FROM_NAME=Aarya Clothing
      - EMAIL_OTP_USE_QUEUE=true
      - SMTP_SEND_MAX_ATTEMPTS=3
      - OTP_CODE_LENGTH=6
      - OTP_EXPIRY_MINUTES=10
      - OTP_MAX_ATTEMPTS=3
      - OTP_RESEND_COOLDOWN_MINUTES=1
      - OTP_MAX_RESEND_PER_HOUR=5
    depends_on:
      postgres:
        condition: service_healthy
      pgbouncer:
        condition: service_started
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 768M
          cpus: '1.0'
        reservations:
          memory: 128M
          cpus: '0.25'
    networks:
      - backend_network
    restart: unless-stopped
    volumes:
      - ./shared:/app/shared

  # ============================================================
  # COMMERCE SERVICE (Port 5002) — 4 WORKERS
  # ============================================================

  commerce:
    build:
      context: .
      dockerfile: services/commerce/Dockerfile
    container_name: aarya_commerce
    env_file:
      - .env
    environment:
      - SERVICE_NAME=commerce
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@pgbouncer:6432/aarya_clothing
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/1
      - REDIS_DB=1
      - SECRET_KEY=${SECRET_KEY}
      - ALLOWED_ORIGINS=["https://aaryaclothing.in","https://www.aaryaclothing.in"]
      - DEBUG=false
      - LOG_LEVEL=WARNING
      - INTERNAL_SERVICE_SECRET=${INTERNAL_SERVICE_SECRET}
      - MEILISEARCH_URL=http://meilisearch:7700
      - MEILISEARCH_API_KEY=${MEILI_MASTER_KEY}
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=aarya-clothing-images
      - R2_PUBLIC_URL=https://pub-7846c786f7154610b57735df47899fa0.r2.dev
      - R2_REGION=auto
    depends_on:
      postgres:
        condition: service_healthy
      pgbouncer:
        condition: service_started
      redis:
        condition: service_healthy
      meilisearch:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5002/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.5'
        reservations:
          memory: 128M
          cpus: '0.25'
    networks:
      - backend_network
    restart: unless-stopped
    volumes:
      - ./shared:/app/shared

  # ============================================================
  # PAYMENT SERVICE (Port 5003) — 2 WORKERS
  # ============================================================

  payment:
    build:
      context: .
      dockerfile: services/payment/Dockerfile
    container_name: aarya_payment
    env_file:
      - .env
    environment:
      - SERVICE_NAME=payment
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@pgbouncer:6432/aarya_clothing
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/2
      - REDIS_DB=2
      - SECRET_KEY=${SECRET_KEY}
      - ALLOWED_ORIGINS=["https://aaryaclothing.in","https://www.aaryaclothing.in"]
      - DEBUG=false
      - LOG_LEVEL=WARNING
      - RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
      - RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}
      - RAZORPAY_WEBHOOK_SECRET=${RAZORPAY_WEBHOOK_SECRET}
      - INTERNAL_SERVICE_SECRET=${INTERNAL_SERVICE_SECRET}
      - FRONTEND_URL=https://aaryaclothing.in
    depends_on:
      postgres:
        condition: service_healthy
      pgbouncer:
        condition: service_started
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5003/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    networks:
      - backend_network
    restart: unless-stopped
    volumes:
      - ./shared:/app/shared

  # ============================================================
  # PAYMENT WORKER
  # ============================================================

  payment-worker:
    build:
      context: .
      dockerfile: services/payment/Dockerfile
    container_name: aarya_payment_worker
    command: ["python", "-m", "jobs.worker"]
    env_file:
      - .env
    environment:
      - SERVICE_NAME=payment-worker
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@pgbouncer:6432/aarya_clothing
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/2
      - REDIS_DB=2
      - SECRET_KEY=${SECRET_KEY}
      - DEBUG=false
      - LOG_LEVEL=WARNING
      - RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
      - RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      pgbouncer:
        condition: service_started
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import redis; r=redis.Redis.from_url('redis://:${REDIS_PASSWORD}@redis:6379/2'); r.ping()"]
      interval: 30s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'
    networks:
      - backend_network
    restart: unless-stopped
    volumes:
      - ./shared:/app/shared

  # ============================================================
  # ADMIN SERVICE (Port 5004) — 2 WORKERS
  # ============================================================

  admin:
    build:
      context: .
      dockerfile: services/admin/Dockerfile
    container_name: aarya_admin
    env_file:
      - .env
    environment:
      - SERVICE_NAME=admin
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@pgbouncer:6432/aarya_clothing
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/3
      - REDIS_DB=3
      - SECRET_KEY=${SECRET_KEY}
      - ALLOWED_ORIGINS=["https://aaryaclothing.in","https://www.aaryaclothing.in"]
      - DEBUG=false
      - LOG_LEVEL=WARNING
      - INTERNAL_SERVICE_SECRET=${INTERNAL_SERVICE_SECRET}
      - MEILISEARCH_URL=http://meilisearch:7700
      - MEILISEARCH_API_KEY=${MEILI_MASTER_KEY}
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=aarya-clothing-images
      - R2_PUBLIC_URL=https://pub-7846c786f7154610b57735df47899fa0.r2.dev
      - R2_REGION=auto
    depends_on:
      postgres:
        condition: service_healthy
      pgbouncer:
        condition: service_started
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5004/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 768M
          cpus: '1.0'
    networks:
      - backend_network
    restart: unless-stopped
    volumes:
      - ./shared:/app/shared

  # ============================================================
  # FRONTEND — Next.js
  # ============================================================

  frontend:
    build:
      context: .
      dockerfile: frontend_new/Dockerfile
    container_name: aarya_frontend
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://aaryaclothing.in
      - NEXT_PUBLIC_SITE_URL=https://aaryaclothing.in
    depends_on:
      - nginx
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.5'
        reservations:
          memory: 256M
          cpus: '0.25'
    networks:
      - backend_network
      - frontend_network
    restart: unless-stopped

  # ============================================================
  # NGINX REVERSE PROXY
  # ============================================================

  nginx:
    image: nginx:alpine
    container_name: aarya_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - frontend
      - core
      - commerce
      - payment
      - admin
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 15s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.5'
    networks:
      - frontend_network
      - backend_network
    restart: unless-stopped

networks:
  frontend_network:
    driver: bridge
  backend_network:
    driver: bridge
    internal: true  # No external access to backend

volumes:
  postgres_data:
  redis_data:
  meilisearch_data:
  nginx_logs:
```

---

## 9. DOCKERFILE FIXES

### 9.1 All Backend Service Dockerfiles — Change CMD to Use Workers

**File:** `services/commerce/Dockerfile`

```dockerfile
# BEFORE:
CMD ["python", "main.py"]

# AFTER:
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5002", "--workers", "4", "--log-level", "warning", "--no-access-log"]
```

**File:** `services/core/Dockerfile`

```dockerfile
# BEFORE:
CMD ["python", "main.py"]

# AFTER:
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "4", "--log-level", "warning", "--no-access-log"]
```

**File:** `services/payment/Dockerfile`

```dockerfile
# BEFORE:
CMD ["python", "main.py"]

# AFTER:
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5003", "--workers", "2", "--log-level", "warning", "--no-access-log"]
```

**File:** `services/admin/Dockerfile`

```dockerfile
# BEFORE:
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5004"]

# AFTER:
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5004", "--workers", "2", "--log-level", "warning", "--no-access-log"]
```

### 9.2 Redis Config Fix

**File:** `docker/redis/redis.conf`

```
# CHANGE:
maxmemory-policy volatile-lru
# TO:
maxmemory-policy allkeys-lru

# CHANGE:
maxmemory 200mb
# TO:
maxmemory 400mb
```

---

## 10. CODE-LEVEL FIXES

### 10.1 Fix OTP Email Worker (Core Service)

**File:** `services/core/service/email_queue.py`

Replace the entire `run_otp_email_worker()` function with the async Redis version shown in Section 2.1.

### 10.2 Fix Database.py — Reduce Pool Sizes for PgBouncer

**File:** `services/core/database/database.py`

```python
# Change defaults when using PgBouncer:
DATABASE_POOL_SIZE = 5       # was 10
DATABASE_MAX_OVERFLOW = 10   # was 20

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=DATABASE_POOL_SIZE,
    max_overflow=DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=1800,       # 30 min
    pool_timeout=10,         # Fail fast if pool exhausted
    echo=DEBUG
)
```

### 10.3 Fix Shared Config — Reduce Default Pool Sizes

**File:** `shared/base_config.py`

```python
# Line 48-49 — change:
DATABASE_POOL_SIZE: int = 5       # was 10
DATABASE_MAX_OVERFLOW: int = 10   # was 20
```

### 10.4 Fix Commerce — Add Caching to Product Endpoints

**File:** `services/commerce/main.py`

For the product detail endpoint, add caching around the DB query. The commerce service already has a `cached` decorator / `cache.get_or_set` method — use it on product browse, product detail, and related products.

### 10.5 Fix Commerce — N+1 Query on Collections

**File:** `services/commerce/main.py` — `list_collections()`

```python
# BEFORE (lazy loads products for each collection):
collections = query.order_by(...).all()

# AFTER (eager load):
from sqlalchemy.orm import joinedload
collections = query.options(joinedload(Collection.products)).order_by(...).all()
```

### 10.6 Add Limit to Product Browse

**File:** `services/commerce/main.py` — `list_products()` endpoint

```python
# Add cap to limit parameter:
limit: int = Query(24, ge=1, le=100),  # Cap at 100 to prevent abuse
```

### 10.7 Fix Frontend — Null Collection Slug Guard

Find the collection page component and add:

```javascript
// At the top of the server component:
export default async function CollectionPage({ params }) {
    const slug = params.slug;

    // Guard against null/undefined slugs
    if (!slug || slug === 'null' || slug === 'undefined') {
        notFound();
    }

    // ... rest of the component
}
```

### 10.8 Fix Frontend — Add Request Timeouts

**File:** `frontend_new/lib/baseApi.js`

```javascript
// In the fetch method, add timeout:
async fetch(path, options = {}) {
    const url = this.buildUrl(path);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            credentials: 'include',
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.');
        }
        throw error;
    }
}
```

---

## 11. DEPLOYMENT PROCEDURE

### Step 1: Add Swap File (Safety Net)

```bash
# On the VPS:
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Step 2: Create PgBouncer Userlist

```bash
mkdir -p /opt/Aarya_clothing_frontend/docker/pgbouncer
echo '"postgres" "YOUR_POSTGRES_PASSWORD"' > docker/pgbouncer/userlist.txt
```

### Step 3: Update .env File

Ensure these are set in your `.env`:

```env
POSTGRES_PASSWORD=<strong_password>
REDIS_PASSWORD=<strong_password>
SECRET_KEY=<at_least_64_chars_random>
INTERNAL_SERVICE_SECRET=<random_string>
MEILI_MASTER_KEY=<random_string>
SMTP_PASSWORD=<your_smtp_password>
RAZORPAY_KEY_ID=<your_key>
RAZORPAY_KEY_SECRET=<your_secret>
RAZORPAY_WEBHOOK_SECRET=<your_secret>
ENVIRONMENT=production
COOKIE_SECURE=true
```

### Step 4: Update All Source Files

Apply all code fixes from Section 10.

### Step 5: Update docker-compose.yml

Replace with the optimized version from Section 8.

### Step 6: Update All Dockerfiles

Apply CMD changes from Section 9.

### Step 7: Rebuild and Deploy

```bash
cd /opt/Aarya_clothing_frontend

# Stop everything
docker-compose down

# Rebuild all images
docker-compose build --no-cache

# Start everything
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Check logs for errors
docker-compose logs -f --tail=50
```

### Step 8: Verify

```bash
# Check all services healthy
docker-compose ps

# Test registration (OTP should work)
curl -X POST https://aaryaclothing.in/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","verification_method":"otp_email"}'

# Check Postgres connections
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis
docker exec aarya_redis redis-cli -a "$REDIS_PASSWORD" INFO stats

# Check PgBouncer
docker exec aarya_pgbouncer psql -h localhost -p 6432 -U postgres -d aarya_clothing -c "SELECT 1;"
```

---

## 12. MONITORING & ALERTS

### 12.1 Health Check Script

Create `scripts/healthcheck.sh`:

```bash
#!/bin/bash
echo "=== Aarya Clothing Health Check ==="
echo "Date: $(date)"
echo ""

# Container status
echo "--- Container Status ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.RunningFor}}"
echo ""

# Resource usage
echo "--- Resource Usage ---"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""

# Error counts (last 100 lines)
echo "--- Error Counts ---"
for container in aarya_core aarya_commerce aarya_frontend aarya_admin aarya_payment; do
    errors=$(docker logs --tail 100 $container 2>&1 | grep -ci "error\|exception\|fatal" || echo 0)
    echo "$container: $errors errors in last 100 lines"
done
echo ""

# Postgres
echo "--- Postgres Connections ---"
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "SELECT count(*) as connections FROM pg_stat_activity;" 2>/dev/null
echo ""

# Redis
echo "--- Redis Stats ---"
docker exec aarya_redis redis-cli -a "$(grep REDIS_PASSWORD .env | cut -d= -f2)" --no-auth-warning INFO stats 2>/dev/null | grep -E "keyspace_hits|keyspace_misses|evicted_keys"
echo ""

# Disk
echo "--- Disk Usage ---"
df -h /
echo ""

# Load
echo "--- System Load ---"
uptime
```

### 12.2 Log Rotation

Add to nginx config:
```nginx
access_log /var/log/nginx/access.log combined buffer=64k flush=1m;
error_log /var/log/nginx/error.log warn;
```

And set up logrotate:
```
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}
```

---

## 13. WHAT WE DO NOT NEED

### ❌ Kubernetes / ECS

**Not needed.** Your VPS has:
- 4 vCPUs, 16GB RAM — enough for 500+ concurrent users with optimization
- Single server — K8s is for multi-server clusters
- Current traffic: ~2.6 req/sec — K8s would add 2-4 GB overhead for zero benefit

**K8s is needed when:**
- You need auto-scaling across multiple servers
- You need zero-downtime deployments with rolling updates
- You have 10+ microservices with complex networking
- You have a dedicated DevOps team

**For now:** Docker Compose + proper resource limits + PgBouncer handles everything.

### ❌ Separate Redis Instances

**Not needed.** One Redis server with logical DBs (0, 1, 2, 3) works perfectly. At 8.47 MB / 200 MB used, there's no memory pressure.

### ❌ Database Read Replicas

**Not needed.** 15 MB database, no slow queries, 19 connections max. Postgres handles this easily.

### ❌ CDN for Static Assets

**Not needed yet.** Your R2 storage already serves images via Cloudflare's global CDN. Next.js static assets are served from nginx with proper cache headers.

---

## 14. EXPECTED CAPACITY AFTER OPTIMIZATIONS

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Python Workers** | 4 total (1 per service) | 12 total (4+4+2+2) | **3x** |
| **DB Connections** | 100 direct, competing | 500 via PgBouncer, pooled | **5x** |
| **API Throughput** | ~10 req/sec | ~150+ req/sec | **15x** |
| **Concurrent Users** | ~20-30 | ~500+ | **17x** |
| **OTP Registration** | BROKEN (500 errors) | Working | **∞** |
| **Cache Hit Rate** | 40% | 70%+ | **+75%** |
| **Memory Utilization** | 51% | 65-75% | Efficient |
| **CPU Utilization** | 21% | 50-70% | Efficient |

### Resource Budget After Optimization

| Container | Memory | CPU | Workers |
|-----------|--------|-----|---------|
| Postgres | 2 GB | 1.5 cores | — |
| PgBouncer | 128 MB | 0.25 cores | — |
| Redis | 512 MB | 0.5 cores | — |
| Meilisearch | 512 MB | 0.5 cores | — |
| Core | 768 MB | 1.0 cores | 4 |
| Commerce | 1 GB | 1.5 cores | 4 |
| Payment | 512 MB | 0.5 cores | 2 |
| Payment Worker | 256 MB | 0.25 cores | 1 |
| Admin | 768 MB | 1.0 cores | 2 |
| Frontend | 2 GB | 1.5 cores | — |
| Nginx | 256 MB | 0.5 cores | — |
| **TOTAL** | **~9.7 GB** | **~7.5 cores** | **13** |

**Note:** Total CPU (7.5 cores) exceeds VPS (4 vCPUs) because of oversubscription. Under normal load, not all workers are active simultaneously. The limits are **ceilings**, not reservations. Normal load uses ~20-30% of allocated.

**Under sustained 100% load:** The kernel's CFS scheduler will time-slice fairly. Response times will increase but services won't crash.

---

## 15. ROLLBACK PLAN

If anything goes wrong after deployment:

```bash
# 1. Stop everything
cd /opt/Aarya_clothing_frontend
docker-compose down

# 2. Restore the old docker-compose.yml from git
git checkout HEAD -- docker-compose.yml

# 3. Rebuild with old config
docker-compose build

# 4. Start
docker-compose up -d

# 5. Verify
docker-compose ps
```

All data is in Docker volumes (postgres_data, redis_data, meilisearch_data) — these are NEVER deleted by `docker-compose down`.

---

## 16. SUMMARY OF ALL CHANGES

### Docker/Infrastructure Changes
| File | Change | Priority |
|------|--------|----------|
| `docker-compose.yml` | Add PgBouncer, increase limits, remove external postgres port, add swap safety | P0 |
| `services/*/Dockerfile` (4 files) | Change CMD to uvicorn with --workers | P0 |
| `docker/redis/redis.conf` | Change eviction to allkeys-lru, increase maxmemory to 400MB | P1 |
| `docker/nginx/nginx.conf` | Add rate limiting, increase timeouts, add worker_processes auto | P1 |
| `docker/pgbouncer/userlist.txt` | **NEW FILE** — PgBouncer auth | P0 |

### Backend Code Changes
| File | Change | Priority |
|------|--------|----------|
| `services/core/service/email_queue.py` | Replace worker with async Redis + reconnection | P0 |
| `services/core/database/database.py` | Reduce pool_size to 5, add pool_timeout | P0 |
| `shared/base_config.py` | Reduce default pool sizes | P0 |
| `services/commerce/main.py` | Add caching to product endpoints, add limit cap, fix N+1 queries | P1 |
| `services/core/main.py` | Add workers to uvicorn | P0 |
| `services/payment/main.py` | Add workers to uvicorn | P0 |
| `services/admin/main.py` | Add workers to uvicorn | P0 |

### Frontend Code Changes
| File | Change | Priority |
|------|--------|----------|
| `frontend_new/lib/baseApi.js` | Add 15s request timeout with AbortController | P1 |
| `frontend_new/app/collections/[slug]/page.js` | Guard against null/undefined slug | P1 |
| `frontend_new/app/layout.js` | Add deployment version meta tag | P2 |

### Environment Changes
| File | Change | Priority |
|------|--------|----------|
| `.env` | Set SECRET_KEY, ENVIRONMENT=production, COOKIE_SECURE=true | P0 |
| System | Add 4GB swap file | P1 |

---

**This plan fixes every identified issue without adding infrastructure complexity.** Everything stays on this single VPS. The key insight is that your hardware is powerful enough — the bottleneck is software configuration (1 worker per service, no connection pooling, broken email queue). After these fixes, you'll handle 15-20x more traffic on the same hardware.
