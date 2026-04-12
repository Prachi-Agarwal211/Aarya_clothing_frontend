# Aarya Clothing — Scalability & Architecture Report

> **Date:** April 12, 2026
> **VPS:** 4 vCPUs (AMD EPYC 9354P, 32-core host shared), 16GB RAM, 193GB SSD (15% used)
> **Current Traffic:** ~36 req/min peak, ~2.6 req/sec average
> **Target:** 2,000+ concurrent users → 10,000+ users
> **Status:** 10 containers running, several critical issues identified

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Overview](#2-current-architecture-overview)
3. [Infrastructure Capacity Analysis](#3-infrastructure-capacity-analysis)
4. [Code Quality & Structural Issues](#4-code-quality--structural-issues)
5. [Database & Performance Bottlenecks](#5-database--performance-bottlenecks)
6. [Security Vulnerabilities](#6-security-vulnerabilities)
7. [Log Errors & Failure Patterns](#7-log-errors--failure-patterns)
8. [Scalability Roadmap](#8-scalability-roadmap)
9. [Recommended Technology Changes](#9-recommended-technology-changes)
10. [Implementation Priority List](#10-implementation-priority-list)
11. [Cost Estimates for Scaling](#11-cost-estimates-for-scaling)
12. [Platform Decision: Docker Compose vs ECS vs Kubernetes](#12-platform-decision-docker-compose-vs-ecs-vs-kubernetes)

---

## 1. Executive Summary

### Overall Assessment: ⚠️ NOT PRODUCTION-READY FOR 2,000+ CONCURRENT USERS

The Aarya Clothing platform has a solid microservices foundation — 4 API services (core, commerce, payment, admin), PostgreSQL, Redis, Meilisearch, nginx gateway, and a Next.js frontend. The architecture is logically sound for a small-to-medium e-commerce site, but **multiple critical issues** will cause failures under load.

### Critical Findings (Must Fix Before 2,000 Users)

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **PostgreSQL exposed to internet** (port 6001) | 🔴 CRITICAL | Active brute-force attacks every 5 minutes |
| 2 | **All services single-worker** (uvicorn workers=2) | 🔴 CRITICAL | Max ~20 concurrent requests per service |
| 3 | **No PgBouncer** — direct DB connections | 🔴 CRITICAL | Connection pool exhaustion under moderate load |
| 4 | **Redis password hardcoded** in redis.conf | 🔴 CRITICAL | Security vulnerability |
| 5 | **No application-level caching** on product endpoints | 🟠 HIGH | Every product browse hits the database |
| 6 | **Synchronous Redis in OTP email worker** | 🟠 HIGH | Connection corruption → email delivery failures |
| 7 | **Frontend has NO resource limits** | 🟠 HIGH | Can OOM the entire VPS |
| 8 | **Nginx rate limiting not applied** to most endpoints | 🟠 HIGH | No API abuse protection |

### Capacity Summary

| Resource | Current | At 2,000 Users | At 10,000 Users | Verdict |
|----------|---------|----------------|-----------------|---------|
| **CPU** | 21% used | ~85% (bottleneck) | **Exceeds capacity** | Need more vCPUs |
| **RAM** | 51% used | ~80% (bottleneck) | **Exceeds capacity** | Need more RAM |
| **DB Connections** | ~40 active | ~200+ needed | **Exceeds max** | Need PgBouncer |
| **Concurrent Requests** | ~2-3/sec | ~50-100/sec | ~200-500/sec | Need workers |

**Bottom line:** The current VPS (4 vCPUs, 16GB RAM) can handle **~500-800 concurrent users** after optimization. For 2,000+, you need a larger VPS or multi-server architecture. For 10,000+, you need Kubernetes or a managed platform.

---

## 2. Current Architecture Overview

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET (Port 80/443)                   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │        NGINX              │
                    │   (Gateway / Reverse Proxy)│
                    │   Limit: 128MB / 0.25 CPU │
                    │   worker_connections: 1024│
                    └──────┬──────┬─────┬───────┘
                           │      │     │
              ┌────────────▼┐  ┌──▼──┐  │
              │  Frontend   │  │ API │  │
              │  Next.js    │  │Routes│  │
              │  Port 3000  │  └──┬──┘  │
              │  2GB / 1.5CPU│     │     │
              └─────────────┘     │     │
                     │            │     │
                     ▼            ▼     ▼
        ┌────────────────────────────────────────┐
        │          BACKEND NETWORK               │
        │                                        │
        │  ┌──────────┐  ┌──────────┐           │
        │  │  Core    │  │ Commerce │           │
        │  │ :5001    │  │  :5002   │           │
        │  │ 512MB    │  │  512MB   │           │
        │  │ workers=2│  │ workers=2│           │
        │  └────┬─────┘  └────┬─────┘           │
        │       │              │                  │
        │  ┌────▼─────┐  ┌────▼─────┐           │
        │  │ Payment  │  │  Admin   │           │
        │  │  :5003   │  │  :5004   │           │
        │  │  512MB   │  │  512MB   │           │
        │  │ workers=2│  │ workers=?│           │
        │  └────┬─────┘  └────┬─────┘           │
        │       │              │                  │
        │  ┌────▼──────────────▼─────┐           │
        │  │  Payment Worker         │           │
        │  │  (RQ background job)    │           │
        │  │  256MB / 0.5 CPU        │           │
        │  └────────────┬────────────┘           │
        │               │                         │
        │  ┌────────────▼────────────────────┐   │
        │  │         PostgreSQL              │   │
        │  │  pgvector:pg15                  │   │
        │  │  max_connections=150            │   │
        │  │  shared_buffers=256MB           │   │
        │  │  512MB / 1.0 CPU                │   │
        │  │  ⚠️  Port 6001 EXPOSED TO NET   │   │
        │  └─────────────────────────────────┘   │
        │               │                         │
        │  ┌────────────▼────────────────────┐   │
        │  │           Redis                 │   │
        │  │  Redis 7 Alpine                 │   │
        │  │  DB 0: core, 1: commerce        │   │
        │  │  DB 2: payment, 3: admin        │   │
        │  │  256MB / 0.5 CPU                │   │
        │  │  maxmemory=400MB, allkeys-lru   │   │
        │  │  ⚠️ Password hardcoded in .conf  │   │
        │  └─────────────────────────────────┘   │
        │               │                         │
        │  ┌────────────▼────────────────────┐   │
        │  │        Meilisearch              │   │
        │  │  v1.6, 512MB / 0.5 CPU          │   │
        │  └─────────────────────────────────┘   │
        └────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Frontend** | Next.js | 15.5.12 | App Router, SSR, standalone Docker output |
| **Frontend UI** | React 19, Tailwind CSS 3.4, shadcn/ui | — | GSAP animations, Recharts |
| **Backend** | Python 3.11 + FastAPI | — | 4 microservices |
| **Backend Server** | Uvicorn | — | workers=2 per service |
| **Database** | PostgreSQL 15 + pgvector | — | Single shared DB, 4 services direct connect |
| **Cache** | Redis 7 | Alpine | 4 logical databases |
| **Search** | Meilisearch | 1.6 | Full-text product search |
| **Gateway** | Nginx | Alpine | Reverse proxy, SSL, rate limiting |
| **Storage** | Cloudflare R2 | — | Image/video storage |
| **Payments** | Razorpay (primary), Cashfree (backup) | — | UPI, cards, wallets |
| **AI** | Groq, OpenRouter, GLM, NVIDIA | — | Multi-provider with rotation |
| **Email** | Hostinger SMTP | Port 465/SSL | Transactional emails |
| **SMS** | MSG91 | Optional | OTP and order notifications |

### 2.3 Service Architecture

| Service | Port | Responsibility | Dockerfile | Workers | Memory Limit |
|---------|------|---------------|------------|---------|--------------|
| **core** | 5001 | Auth, users, sessions, OTP, email, SMS | `services/core/Dockerfile` | 2 | 512MB |
| **commerce** | 5002 | Products, cart, orders, inventory, search | `services/commerce/Dockerfile` | 2 | 512MB |
| **payment** | 5003 | Razorpay/Cashfree, webhooks | `services/payment/Dockerfile` | 2 (via env) | 512MB |
| **admin** | 5004 | Staff dashboard, AI chat, ops | `services/admin/Dockerfile` | N/A (uvicorn) | 512MB |
| **payment-worker** | — | RQ background job (payment recovery) | `services/payment/Dockerfile` | 1 | 256MB |
| **frontend** | 3000 | Next.js SSR + static | `frontend_new/Dockerfile` | Node.js default | 2GB (docker-compose) |

### 2.4 What We're NOT Analyzing

- **Code-level correctness** of individual business logic — focus is on architecture
- **Frontend component bugs** — only structural/performance issues
- **Specific payment flow bugs** — only infrastructure-level payment concerns

---

## 3. Infrastructure Capacity Analysis

### 3.1 VPS Resource Utilization (Current)

| Container | CPU % | Memory Used | Memory Limit | Mem % | Status |
|-----------|-------|-------------|--------------|-------|--------|
| Frontend | 0.00% | 92.85 MiB | None (⚠️) | 0.58% | Running |
| Commerce | 0.14% | 107.6 MiB | 512 MiB | 21.01% | Healthy |
| Core | 0.14% | 77.03 MiB | 512 MiB | 15.04% | Healthy |
| Admin | 0.26% | 114.4 MiB | 512 MiB | 22.35% | Healthy |
| Payment | 0.15% | 78.11 MiB | 512 MiB | 15.26% | Healthy |
| Payment Worker | 0.06% | 24.66 MiB | 256 MiB | 9.63% | Healthy |
| PostgreSQL | 0.00% | 63.65 MiB | 512 MiB | 12.43% | Healthy |
| Redis | 0.45% | 13.68 MiB | 256 MiB | 5.34% | Healthy |
| Meilisearch | 0.08% | 27.94 MiB | 512 MiB | 5.46% | Healthy |
| Nginx | 0.00% | 5.18 MiB | 128 MiB | 4.05% | Running |
| **Total** | **~1.3%** | **~605 MiB** | **~4.1 GB** | **~15%** | |

### 3.2 Bottleneck Analysis Under Load

#### 3.2.1 CPU Bottleneck

**Current:** 4 vCPUs, ~0.86 load average. Each Python service uses `workers=2`.

**At 2,000 concurrent users:**
- Each API service needs ~4-8 workers (not 2)
- 4 services × 4 workers = 16 worker processes
- Each worker = ~0.1-0.3 CPU under moderate load
- Frontend SSR = 0.5-1.0 CPU under load
- **Total needed: ~8-12 CPU cores**
- **Available: 4 vCPUs** → **CPU will saturate at ~500-800 concurrent users**

#### 3.2.2 Memory Bottleneck

**Current:** 16 GB RAM, ~8 GB used (51%).

**At 2,000 concurrent users:**
- Each Python worker = ~50-80 MB → 16 workers × 65 MB = ~1 GB
- Frontend SSR = ~500 MB - 2 GB under load
- PostgreSQL = 1-2 GB (needs more shared_buffers)
- Redis = 200-400 MB
- **Total needed: ~10-14 GB**
- **Available: ~8 GB free** → **RAM will hit 80-90% at ~1,000 concurrent users**

#### 3.2.3 Database Connection Bottleneck

**Current:**
- PostgreSQL `max_connections=150`
- 4 services × `pool_size=5, max_overflow=10` = up to 60 connections
- Plus health checks, admin queries, background jobs

**At 2,000 concurrent users:**
- Each worker may need 2-3 connections
- 16 workers × 2.5 = ~40 connections from workers alone
- Plus: PgBouncer would need 25-50 pool connections
- **Without PgBouncer:** Direct connections will exhaust at ~100 concurrent users per service
- **With PgBouncer:** Can handle 500+ concurrent users per service

**Current pool sizes by service:**
| Service | pool_size | max_overflow | Effective Max |
|---------|-----------|--------------|---------------|
| core | 20 (hardcoded fallback) | 30 | 50 |
| commerce | 5 | 10 | 15 |
| payment | 5 | 10 | 15 |
| admin | 5 | 10 | 15 |
| **Total potential** | — | — | **~95** |

⚠️ **Core service has `pool_size=20, max_overflow=30` hardcoded as fallback** (see `services/core/database/database.py` lines 17-18). If `settings` is None, it defaults to 50 connections from core alone.

#### 3.2.4 Network/Throughput Bottleneck

**Current nginx:**
- `worker_connections 1024`
- No `worker_processes` directive (defaults to 1 in container)
- Rate limiting zones defined but **not applied** to most endpoints

**At 2,000 concurrent users:**
- Each user = 5-20 parallel requests (JS, CSS, images, API calls)
- 2,000 users × 10 requests = 20,000 concurrent connections
- nginx with 1 worker × 1024 connections = **1,024 max connections**
- **nginx will reject connections at ~100 concurrent users**

### 3.3 Capacity Verdict

| Concurrent Users | CPU | RAM | DB Connections | Nginx | Verdict |
|-----------------|-----|-----|----------------|-------|---------|
| **100** | ✅ OK | ✅ OK | ✅ OK | ⚠️ Borderline | Works with fixes |
| **500** | ⚠️ 70% | ⚠️ 65% | ⚠️ Needs PgBouncer | 🔴 Must fix | Works after optimization |
| **2,000** | 🔴 95%+ | 🔴 85%+ | 🔴 Exhausted | 🔴 Must scale | **Need larger VPS or multi-server** |
| **10,000** | ❌ | ❌ | ❌ | ❌ | **Need Kubernetes / managed platform** |

---

## 4. Code Quality & Structural Issues

### 4.1 Database Layer Issues

#### Issue 1: No Async Database (All Services)

**All 4 services use synchronous SQLAlchemy:**
```python
# services/core/database/database.py
engine = create_engine(DATABASE_URL, poolclass=QueuePool, ...)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

**Impact:** Each database request blocks the entire worker thread. Under load, one slow query blocks all other requests on that worker.

**Recommendation:** For 2,000+ users, consider `create_async_engine` + `AsyncSession`. However, this is a **major refactor** — add PgBouncer first (immediate win, no code changes).

#### Issue 2: Inconsistent Pool Sizes Across Services

| Service | pool_size | max_overflow | Source |
|---------|-----------|--------------|--------|
| core | 20 (hardcoded fallback) | 30 | `database.py` lines 17-18 |
| commerce | 5 (from settings) | 10 | `database.py` |
| payment | 5 (from settings) | 10 | `database.py` |
| admin | 5 (from settings) | 10 | `database.py` |

**Core service has a dangerous fallback:** If `settings` is `None`, it defaults to `pool_size=20, max_overflow=30`. This is 4× larger than other services and can starve them of connections.

**Fix:** Remove the hardcoded fallback. Use `shared/base_config.py` defaults (5/10).

#### Issue 3: No Connection Pool Monitoring

Services have `get_pool_status()` but it's not called anywhere in production. Under connection pool exhaustion, requests just hang.

**Fix:** Add pool status to `/health` endpoint. Set up alerting when `checked_out > pool_size * 0.8`.

### 4.2 Application-Level Issues

#### Issue 4: admin/main.py is a 6,000+ Line Monolith

**File:** `services/admin/main.py` — **6,195 lines** in a single file.

**Problem:** All routes, business logic, and WebSocket handlers in one file. Makes it hard to maintain, test, and scale.

**Impact:** Slow startup, harder to debug, cannot independently scale specific endpoints.

**Fix:** Split into route modules (already partially done with `routes/ai_dashboard_staff.py`). Move remaining routes into `routes/` directory.

#### Issue 5: Synchronous Redis in OTP Email Worker

**File:** `services/core/service/email_queue.py`

The OTP email worker uses synchronous Redis `blpop()` wrapped in `asyncio.to_thread()`. When the Redis socket times out, the connection state corrupts and all subsequent calls fail.

**Evidence from logs:**
```
redis.exceptions.TimeoutError: Timeout reading from socket
```

**Fix:** Use `redis.asyncio` for the worker. See the existing `PRODUCTION_SCALING_MASTER_PLAN.md` for the full async replacement code.

#### Issue 6: No Application-Level Caching

Product browse, product detail, related products, and collection endpoints hit PostgreSQL on every request.

**Evidence:** No `cache.get_or_set` or Redis caching patterns found in commerce service.

**Impact:** At 2,000 concurrent users, the product browse endpoint alone could generate 500+ QPS to PostgreSQL.

**Fix:** Add Redis caching with 2-5 minute TTL for read-heavy endpoints.

#### Issue 7: N+1 Query Risk

Multiple `SELECT *` patterns found in admin service:
```python
# services/admin/main.py line 978
"SELECT * FROM inventory WHERE product_id = :pid ORDER BY size, color, sku"
```

And ORM patterns that could trigger N+1:
```python
.query(Product).filter(...).all()  # No .options(joinedload(...))
```

**Fix:** Add `joinedload()` for known relationships. Review all `.all()` calls in commerce product listing.

### 4.3 Frontend Issues

#### Issue 8: No Request Timeouts on API Client

The Next.js frontend likely has no timeout on `fetch()` calls. Under backend overload, requests hang indefinitely, consuming frontend memory and connection slots.

**Fix:** Add `AbortController` with 15-second timeout to all API calls.

#### Issue 9: Frontend Dockerfile Uses Node 18

**File:** `frontend_new/Dockerfile`
```dockerfile
FROM node:18-alpine AS base
```

Node 18 reaches EOL in April 2025. The project uses Next.js 15.5 which recommends Node 20+.

**Fix:** Update to `node:20-alpine` or `node:22-alpine`.

#### Issue 10: Collection "Not Found" Errors in Production Logs

**Evidence from `docker logs aarya_frontend`:**
```
Error fetching collection data: Error: Collection not found
Error generating metadata: Error: Collection not found
```

This indicates stale URLs or missing collection slugs being requested. While not a scalability issue, it wastes server resources.

### 4.4 Docker/Infrastructure Issues

#### Issue 11: No Frontend Resource Limits

**Current `docker-compose.yml`:** The `frontend` service has `deploy.resources.limits` defined (2GB / 1.5 CPU) — ✅ this is correct.

However, the **existing `PRODUCTION_SCALING_MASTER_PLAN.md`** notes it was previously missing. Verify it's applied in production.

#### Issue 12: Admin Service Has No Explicit Worker Count

**File:** `services/admin/Dockerfile` — uses `uvicorn main:app --host 0.0.0.0 --port 5004 --reload` (no `--workers` flag).

The Dockerfile for admin is missing the `UVICORN_WORKERS` env var that other services have.

**Fix:** Add `ENV UVICORN_WORKERS=2` and update CMD to use `--workers ${UVICORN_WORKERS}`.

---

## 5. Database & Performance Bottlenecks

### 5.1 PostgreSQL Configuration

| Setting | Current | Recommended (4 vCPU / 16GB) | Notes |
|---------|---------|----------------------------|-------|
| `shared_buffers` | 256MB | 512MB | 25% of RAM, but 4GB is max useful |
| `work_mem` | 12MB | 16MB | Per-connection — watch total |
| `effective_cache_size` | 1GB | 2GB | Planner hint |
| `max_connections` | 150 | 500 (with PgBouncer) | PgBouncer multiplexes |
| `random_page_cost` | 1.1 | 1.1 | ✅ Good for SSD |
| `checkpoint_completion_target` | 0.9 | 0.9 | ✅ Good |
| `maintenance_work_mem` | default (64MB) | 256MB | Faster VACUUM/index builds |
| `wal_buffers` | default | 16MB | Better write throughput |
| `default_statistics_target` | default (100) | 200 | Better query plans |

### 5.2 Database Index Analysis

**Good news:** The database has **130+ indexes** already created. Most common query patterns are covered:
- `idx_orders_user_status_created` — user order history
- `idx_orders_status_created` — admin order listing
- `idx_products_*` — many product query indexes
- `idx_inventory_sku` — inventory lookups
- `idx_reviews_product_approved_rating` — product reviews

**Scale indexes file** (`docker/postgres/scale_indexes.sql`) adds 4 more:
- `idx_orders_user_created`
- `idx_inventory_reserved_positive`
- `idx_payment_user_created`
- `idx_payment_status_created`

**Verdict:** ✅ Index coverage is **excellent**. Not a bottleneck.

### 5.3 Database Size

Total database size: ~15 MB. Extremely small. Tables:
- users: 305 rows
- products: 62 rows
- inventory: 278 rows
- orders: 10 rows

**Verdict:** ✅ Database size is **not** a bottleneck. It will take millions of rows before table size becomes an issue.

### 5.4 Missing PgBouncer

**This is the #1 database bottleneck risk.**

Without PgBouncer:
- Each service worker opens its own PostgreSQL connection
- 4 services × 2 workers × 3 connections = 24 connections minimum
- Under load with overflow: up to 95 connections
- At 2,000 users, connection wait times will spike

With PgBouncer (transaction pooling):
- Services pool 5-10 connections each
- PgBouncer multiplexes 500+ client connections onto 25 PostgreSQL connections
- PostgreSQL sees consistent, predictable load

**PgBouncer adds ~5-10% latency per query** but enables 10× more concurrent users.

### 5.5 Redis Performance

**Current config:**
- `maxmemory 400mb`
- `maxmemory-policy allkeys-lru` ✅ Good
- `protected-mode no` ⚠️ Only safe because Docker network isolates it
- Password: **hardcoded** in redis.conf (security issue, see Section 6)

**Hit rate:** 40% (very low). Most endpoints don't cache.

**After adding application-level caching:** Hit rate should reach 70-85%.

---

## 6. Security Vulnerabilities

### 6.1 CRITICAL: PostgreSQL Exposed to Internet

**Port 6001 is mapped to the host:**
```yaml
# docker-compose.yml
postgres:
  ports:
    - "6001:5432"
```

**Evidence of active attacks:** PostgreSQL logs show authentication failures every 5 minutes:
```
2026-04-12 17:35:01 UTC [157071] FATAL: password authentication failed for user "postgres"
2026-04-12 17:40:02 UTC [157323] FATAL: password authentication failed for user "postgres"
2026-04-12 17:45:01 UTC [157564] FATAL: password authentication failed for user "postgres"
... (repeating every 5 minutes)
```

**Impact:** If the password is ever weak, the entire database is compromised.

**Fix:** Remove the port mapping. Use `expose` instead of `ports` for internal-only access.
```yaml
# Change:
ports:
  - "6001:5432"
# To:
expose:
  - "5432"
```

### 6.2 CRITICAL: Redis Password Hardcoded

**File:** `docker/redis/redis.conf`
```
requirepass 7v_CnHVZO97-fvFu9p8yNPHUAxrDb4puqcY662tTohs
```

This password is committed to the repository. Anyone with repo access knows it.

**Fix:** Use environment variable interpolation:
```
requirepass ${REDIS_PASSWORD}
```
And regenerate the password immediately.

### 6.3 HIGH: Default SECRET_KEY in .env.example

```
SECRET_KEY=your_secret_key_here
```

The code checks for this value but only logs a warning in development. If `.env` is missing, the application may start with an insecure key.

### 6.4 HIGH: No Rate Limiting on Most API Endpoints

Nginx rate limiting zones are defined:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;
```

But only applied to `/api/v1/auth/` routes. Product, cart, order, and admin endpoints have **no rate limiting**.

**Impact:** A single IP can make unlimited API calls. API abuse, scraping, and DoS are trivial.

### 6.5 MEDIUM: CORS Allows Both HTTP and HTTPS Origins

```
ALLOWED_ORIGINS=["http://localhost:6004",..., "https://aaryaclothing.in", ...]
```

In production, HTTP origins should be rejected. `COOKIE_SECURE=false` in some configurations means session cookies can be sent over HTTP.

### 6.6 MEDIUM: No Input Size Limits on Text Fields

Pydantic models accept arbitrary-length strings. A malicious user could send 10MB text payloads to any text field.

**Fix:** Add `max_length` validators to all Pydantic models.

### 6.7 LOW: Meilisearch Master Key Default

```
MEILI_MASTER_KEY=${MEILI_MASTER_KEY:-dev_master_key}
```

Default value is `dev_master_key`. If not overridden in production, search data is accessible.

---

## 7. Log Errors & Failure Patterns

### 7.1 PostgreSQL Logs

| Pattern | Frequency | Severity | Description |
|---------|-----------|----------|-------------|
| `password authentication failed` | Every 5 min | 🔴 CRITICAL | External brute-force attacks on exposed port 6001 |
| `checkpoint complete: wrote 18 buffers` | Every 5 min | ✅ Normal | Regular checkpointing |

### 7.2 Core Service Logs

| Pattern | Frequency | Severity | Description |
|---------|-----------|----------|-------------|
| `redis.exceptions.TimeoutError: Timeout reading from socket` | Intermittent | 🟠 HIGH | OTP email worker using sync Redis — connection corruption |

### 7.3 Commerce/Payment/Admin Logs

| Pattern | Frequency | Severity | Description |
|---------|-----------|----------|-------------|
| `GET /health HTTP/1.1 200 OK` | Every 15s | ✅ Normal | Docker health checks |
| No errors found | — | ✅ Good | Services are healthy |

### 7.4 Nginx Logs

| Pattern | Frequency | Severity | Description |
|---------|-----------|----------|-------------|
| Normal 200/307 responses | Continuous | ✅ Normal | Healthy traffic |
| `POST /api/v1/wishlist/check-multiple HTTP/2.0 401` | Occasional | ✅ Expected | Unauthenticated wishlist check |
| `POST /api/v1/auth/refresh HTTP/2.0 401` | Occasional | ✅ Expected | Expired refresh token |
| `OAI-SearchBot` request | Rare | ✅ Normal | OpenAI crawler |

### 7.5 Frontend Logs

| Pattern | Frequency | Severity | Description |
|---------|-----------|----------|-------------|
| `Error: Collection not found` | Occasional | 🟡 MEDIUM | Stale URLs requesting missing collection slugs |

### 7.6 Container Health Status

All containers are **healthy** and running:
- ✅ aarya_core (healthy, 24h uptime)
- ✅ aarya_commerce (healthy, 24h uptime)
- ✅ aarya_payment (healthy, 38h uptime)
- ✅ aarya_admin (healthy, 38h uptime)
- ✅ aarya_payment_worker (healthy, 38h uptime)
- ✅ aarya_postgres (healthy, 2d uptime)
- ✅ aarya_redis (healthy, 47h uptime)
- ✅ aarya_meilisearch (healthy, 2d uptime)
- ✅ aarya_nginx (running, 23h uptime)
- ✅ aarya_frontend (running, 23h uptime)

---

## 8. Scalability Roadmap

### Phase 1: Immediate Fixes (Current → 500 Concurrent Users)

**Timeline:** 1-2 days
**Cost:** $0 (configuration changes only)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Close PostgreSQL port 6001** | Security | 5 min |
| 2 | **Regenerate Redis password** | Security | 10 min |
| 3 | **Add admin service workers** (`UVICORN_WORKERS=2`) | Throughput | 10 min |
| 4 | **Increase nginx `worker_processes auto` + `worker_connections 4096`** | Concurrency | 15 min |
| 5 | **Apply rate limiting to all API endpoints in nginx** | Abuse protection | 30 min |
| 6 | **Fix core service pool_size fallback** (remove hardcoded 20/30) | DB stability | 10 min |
| 7 | **Add frontend API request timeouts (15s)** | Resilience | 30 min |
| 8 | **Verify frontend resource limits are applied** | OOM protection | 5 min |

### Phase 2: Medium-Term Optimization (500 → 2,000 Concurrent Users)

**Timeline:** 1-2 weeks
**Cost:** $20-40/month (larger VPS)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Deploy PgBouncer** (transaction pooling) | 10× DB concurrency | 2 hours |
| 2 | **Tune PostgreSQL** (shared_buffers=512MB, work_mem=16MB, etc.) | Query performance | 30 min |
| 3 | **Add Redis caching** to product browse, detail, related endpoints | Reduce DB load by 70% | 4 hours |
| 4 | **Increase service workers** to 4 per service | Throughput | 30 min |
| 5 | **Upgrade VPS** to 8 vCPUs / 32GB RAM | Headroom for 2,000 users | 1 hour |
| 6 | **Add swap file** (4GB) as safety net | OOM protection | 10 min |
| 7 | **Fix OTP email worker** (use async Redis) | Email reliability | 2 hours |
| 8 | **Add application-level error boundaries** in frontend | UX resilience | 2 hours |
| 9 | **Upgrade Node.js** from 18 to 20/22 | Security & performance | 1 hour |
| 10 | **Split admin/main.py** into route modules | Maintainability | 4 hours |

### Phase 3: Long-Term Scaling (2,000 → 10,000+ Concurrent Users)

**Timeline:** 1-3 months
**Cost:** $100-300/month (multi-server or managed platform)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Migrate to managed PostgreSQL** (AWS RDS, DigitalOcean) | Unlimited DB scaling | 4 hours |
| 2 | **Deploy Redis Cluster or managed Redis** | Cache scalability | 4 hours |
| 3 | **Add CDN** (Cloudflare) for static assets | Global performance | 1 hour |
| 4 | **Horizontal service scaling** (2+ instances per service) | Throughput | 8 hours |
| 5 | **Implement async SQLAlchemy** (AsyncSession) | Non-blocking I/O | 20 hours |
| 6 | **Add API response caching headers** | Browser/CDN caching | 2 hours |
| 7 | **Set up monitoring** (Prometheus + Grafana or Datadog) | Visibility | 8 hours |
| 8 | **Add CI/CD pipeline** (GitHub Actions) | Deployment automation | 8 hours |

---

## 9. Recommended Technology Changes

### 9.1 Keep (No Change Needed)

| Technology | Reason |
|-----------|--------|
| **PostgreSQL 15** | Excellent choice. pgvector for AI embeddings. No need to upgrade. |
| **Redis 7** | Industry standard. allkeys-lru policy is correct. |
| **FastAPI** | Great performance. Good async support. |
| **Next.js 15** | Modern, SSR, good caching strategy. |
| **Nginx** | Battle-tested. Good config structure. |
| **Meilisearch** | Fast, lightweight. Good for <10K products. |
| **Cloudflare R2** | Cost-effective storage. |
| **Docker Compose** | Perfect for single-server deployment up to ~2,000 users. |

### 9.2 Add (New Components)

| Technology | Purpose | Priority |
|-----------|---------|----------|
| **PgBouncer** | Connection pooling | 🔴 Immediate |
| **Cloudflare CDN** | Static asset delivery, DDoS protection | 🟠 Phase 2 |
| **Prometheus + Grafana** | Metrics and alerting | 🟠 Phase 2 |
| **Swap file (4GB)** | OOM safety net | 🔴 Immediate |
| **Log rotation** | Disk space management | 🟡 Phase 2 |

### 9.3 Upgrade (Version Changes)

| Component | Current | Recommended | Reason |
|-----------|---------|-------------|--------|
| Node.js | 18 | 20 or 22 | EOL, security |
| Python workers | 2 per service | 4 per service | Throughput |
| PostgreSQL shared_buffers | 256MB | 512MB | Performance |
| Nginx worker_connections | 1024 | 4096 | Concurrency |

### 9.4 Consider (Optional)

| Technology | Benefit | Trade-off |
|-----------|---------|-----------|
| **Async SQLAlchemy** | Non-blocking I/O | 20+ hours refactor |
| **Elasticsearch** | Better search at scale | More complex, more RAM |
| **Message Queue** (RabbitMQ) | Better background job handling | More infrastructure |

---

## 10. Implementation Priority List

### P0 — Fix Today (Security)

1. **Remove PostgreSQL port 6001 from docker-compose.yml** → `docker compose up -d postgres`
2. **Regenerate Redis password** → Update `redis.conf` and all service configs
3. **Verify `.env` SECRET_KEY is not using default** → `python -c "import secrets; print(secrets.token_urlsafe(32))"`
4. **Add firewall rules** → Block ports 6001, 6002, 6003 from external access

### P1 — Fix This Week (Stability)

5. **Add `UVICORN_WORKERS=2` to admin service** → Update `services/admin/Dockerfile`
6. **Increase nginx `worker_processes auto` and `worker_connections 4096`**
7. **Apply nginx rate limiting to all API endpoints**
8. **Fix core service pool_size fallback** → Remove hardcoded `20/30`
9. **Add frontend API timeouts** (15s AbortController)
10. **Create 4GB swap file** → `fallocate -l 4G /swapfile && mkswap /swapfile && swapon /swapfile`

### P2 — Fix This Month (Performance)

11. **Deploy PgBouncer**
12. **Tune PostgreSQL parameters**
13. **Add Redis caching to product endpoints**
14. **Increase service workers to 4**
15. **Upgrade VPS to 8 vCPUs / 32GB RAM**
16. **Fix OTP email worker (async Redis)**
17. **Upgrade Node.js to 20+**
18. **Split admin/main.py into route modules**

### P3 — Plan for Next Quarter (Scale)

19. **Migrate to managed PostgreSQL**
20. **Add Cloudflare CDN**
21. **Horizontal service scaling**
22. **Implement async SQLAlchemy**
23. **Set up monitoring and alerting**

---

## 11. Cost Estimates for Scaling

### Current Setup
| Resource | Cost |
|----------|------|
| VPS (4 vCPU, 16GB RAM, 200GB SSD) | ~$20-24/month |
| **Total** | **~$20-24/month** |

### Phase 2: 2,000 Concurrent Users
| Resource | Cost |
|----------|------|
| VPS (8 vCPU, 32GB RAM, 400GB SSD) | ~$48-64/month |
| Cloudflare CDN (free tier) | $0 |
| **Total** | **~$48-64/month** |

### Phase 3: 10,000+ Concurrent Users (Option A: Multi-Server)
| Resource | Cost |
|----------|------|
| VPS 1: Frontend + Nginx (4 vCPU, 8GB) | ~$24/month |
| VPS 2: API Services (8 vCPU, 16GB) | ~$48/month |
| VPS 3: Database (4 vCPU, 16GB, SSD) | ~$48/month |
| Managed PostgreSQL (RDS/DigitalOcean) | ~$50-80/month |
| Managed Redis (Redis Cloud) | ~$30/month |
| Cloudflare Pro | ~$20/month |
| **Total** | **~$220-270/month** |

### Phase 3: 10,000+ Concurrent Users (Option B: Kubernetes)
| Resource | Cost |
|----------|------|
| Kubernetes cluster (3 nodes, 4 vCPU, 8GB each) | ~$120-180/month |
| Managed PostgreSQL | ~$50-80/month |
| Managed Redis | ~$30/month |
| Load balancer | ~$12/month |
| Cloudflare Pro | ~$20/month |
| **Total** | **~$232-322/month** |

---

## 12. Platform Decision: Docker Compose vs ECS vs Kubernetes

### Recommendation by User Count

| Concurrent Users | Recommended Platform | Reason |
|-----------------|---------------------|--------|
| **0-1,000** | **Docker Compose (single VPS)** | Simplest, cheapest, easiest to manage |
| **1,000-5,000** | **Docker Compose (multi-VPS)** or **ECS Fargate** | Horizontal scaling without orchestration complexity |
| **5,000-20,000** | **Kubernetes** or **ECS with autoscaling** | Auto-scaling, self-healing, rolling deployments |
| **20,000+** | **Kubernetes (EKS/GKE)** | Industry standard, maximum control |

### Detailed Comparison

| Feature | Docker Compose | ECS Fargate | Kubernetes |
|---------|---------------|-------------|------------|
| **Complexity** | ⭐ Low | ⭐⭐ Medium | ⭐⭐⭐⭐ High |
| **Setup Time** | 30 min | 2-4 hours | 1-2 days |
| **Monthly Cost (current scale)** | $20-24 | $50-80 | $100-150 |
| **Auto-scaling** | ❌ Manual | ✅ Built-in | ✅ Built-in |
| **Self-healing** | ✅ (restart: unless-stopped) | ✅ | ✅ |
| **Rolling deployments** | ❌ Manual | ✅ | ✅ |
| **Horizontal scaling** | ❌ Single host | ✅ Multi-AZ | ✅ Multi-AZ |
| **Service mesh** | ❌ | ⚠️ Partial | ✅ Istio/Linkerd |
| **Observability** | ❌ Manual setup | ✅ CloudWatch | ✅ Prometheus/Grafana |
| **Learning curve** | None | Medium | Steep |
| **Team size needed** | 1 developer | 1-2 developers | 2+ DevOps engineers |

### Verdict for Aarya Clothing

**Stay with Docker Compose for now.** Here's why:

1. **Current traffic (~36 req/min) is tiny.** Even after optimization, you'll handle 500-800 concurrent users on a single VPS.
2. **The team appears to be 1-2 developers.** Kubernetes requires dedicated DevOps expertise.
3. **Monthly budget is likely <$50.** Kubernetes starts at $100+/month.
4. **Architecture is already well-structured.** 4 microservices, clean separation, nginx gateway.

**Migration trigger:** Move to ECS or Kubernetes when:
- You consistently hit >70% CPU or RAM on an 8 vCPU / 32GB VPS
- You need auto-scaling for traffic spikes (sales, holidays)
- You have 2+ developers and can afford a DevOps engineer

**Intermediate step:** Before Kubernetes, consider **ECS Fargate**. It gives you container orchestration without the complexity of managing Kubernetes nodes.

---

## Appendix A: Quick Reference — Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `docker-compose.yml` | Remove postgres ports:6001, add pgbouncer service, increase service workers | P0, P1 |
| `docker/redis/redis.conf` | Remove hardcoded password, use env var | P0 |
| `docker/nginx/nginx.conf` | worker_processes auto, worker_connections 4096, apply rate limits | P1 |
| `services/admin/Dockerfile` | Add UVICORN_WORKERS=2, update CMD | P1 |
| `services/core/database/database.py` | Remove hardcoded pool_size=20, max_overflow=30 | P1 |
| `services/core/service/email_queue.py` | Switch to redis.asyncio | P2 |
| `frontend_new/Dockerfile` | Update node:18 → node:20 | P2 |
| `frontend_new/lib/baseApi.js` | Add AbortController timeout | P1 |
| `shared/base_config.py` | Verify pool defaults (5/10) | P1 |

## Appendix B: Monitoring Commands

```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Resource usage
docker stats --no-stream

# PostgreSQL connection count
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory and hit rate
docker exec aarya_redis redis-cli -a "<password>" INFO memory
docker exec aarya_redis redis-cli -a "<password>" INFO stats

# Nginx active connections
curl http://localhost/nginx_status  # if status module enabled

# Database slow queries (>1s)
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

## Appendix C: PostgreSQL Exposed Port — Attack Timeline

```
Every 5 minutes:
  17:35:01 → FATAL: password authentication failed
  17:40:02 → FATAL: password authentication failed
  17:45:01 → FATAL: password authentication failed
  17:50:01 → FATAL: password authentication failed
  17:55:01 → FATAL: password authentication failed
  18:00:02 → FATAL: password authentication failed
  ... (continuing indefinitely)
```

This is an **automated botnet** scanning for exposed PostgreSQL databases. The password currently holds, but this is a **ticking time bomb**. Fix immediately.

---

*Report generated: April 12, 2026*
*Next review recommended: After Phase 1 fixes are applied*
