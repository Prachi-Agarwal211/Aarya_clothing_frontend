# Aarya Clothing — VPS Deep Dive: Uncommitted Changes, Capacity, Scaling Path

**Document purpose:** Single reference for operators and engineers: what changed locally (uncommitted), how the stack scales on **one VPS**, what to optimize next, whether **Kubernetes/ECS** is warranted, and how to run **2000+ req/min** class traffic with buffer — not “magic 2000 concurrent requests” without defining terms.

**Environment note:** This document includes a **live `docker-compose` audit** from the project VPS (see **§0**). Refresh logs after each deploy.

**CLI on this host:** Use **`docker-compose`** (hyphen). The `docker compose` subcommand may be unavailable; Compose **v5.0.2** was verified.

---

## Table of contents

0. [Live VPS audit (docker-compose, logs, stats)](#0-live-vps-audit-docker-compose-logs-stats)
1. [Definitions (concurrency vs RPS vs users)](#1-definitions-concurrency-vs-rps-vs-users)
2. [Hardware assumption & headroom model](#2-hardware-assumption--headroom-model)
3. [Uncommitted changes — inventory & risk](#3-uncommitted-changes--inventory--risk)
4. [Architecture snapshot](#4-architecture-snapshot)
5. [Bottlenecks & what already helps](#5-bottlenecks--what-already-helps)
6. [OTP, email queue, Redis, Postgres](#6-otp-email-queue-redis-postgres)
7. [Payments (Razorpay) — idempotency & races](#7-payments-razorpay--idempotency--races)
8. [Frontend & edge (Next.js, nginx)](#8-frontend--edge-nextjs-nginx)
9. [Logging & observability — current vs recommended](#9-logging--observability--current-vs-recommended)
10. [Do you need ECS / Kubernetes?](#10-do-you-need-ecs--kubernetes)
11. [Phased roadmap (single VPS first)](#11-phased-roadmap-single-vps-first)
12. [Structural / code-quality watchlist](#12-structural--code-quality-watchlist)
13. [2000+ “things” — realistic targets](#13-2000-things--realistic-targets)
14. [Buffer & relaxation strategy](#14-buffer--relaxation-strategy)
15. [Commands to run on the VPS (logs, stats, errors)](#15-commands-to-run-on-the-vps-logs-stats-errors)

---

## 0. Live VPS audit (docker-compose, logs, stats)

**Captured:** development-branch workspace + running containers (healthy stack).

### 0.1 `docker-compose ps` (all services up)

| Service | Container | Status | Notes |
|---------|-----------|--------|--------|
| postgres | aarya_postgres | Up, healthy | Port **6001→5432** published |
| redis | aarya_redis | Up, healthy | Port **6002→6379** published |
| core | aarya_core | Up, healthy | Still running **`python main.py`** in image (not rebuilt with new Dockerfile CMD yet) |
| commerce | aarya_commerce | Up, healthy | **`python main.py`** |
| payment | aarya_payment | Up, healthy | **`python main.py`** |
| admin | aarya_admin | Up, healthy | **`uvicorn main:app`** (single process in observed image) |
| frontend | aarya_frontend | Up | No healthcheck; **~93 MiB** RAM, limit shows **host ~15.6 GiB** (no tight cap in running deployment) |
| nginx | aarya_nginx | Up | 80/443 |
| meilisearch | aarya_meilisearch | Up, healthy | |
| payment-worker | aarya_payment_worker | Up, healthy | |

**Critical gap:** **Uncommitted Dockerfile changes** (uvicorn multi-worker, async OTP worker in **core**) are **not active** until you **`docker-compose build`** and **`docker-compose up -d`**. Running containers still use the **old** `python main.py` entrypoints for core/commerce/payment — so **production behavior ≠ git working tree**.

### 0.2 `docker stats` (snapshot — low traffic period)

Illustrative: **Postgres** can show **~6–15% CPU** briefly; most services **&lt;1% CPU**, memory **well under** per-container limits (except frontend using host-wide limit).

**Implication:** The VPS has **large headroom** at current load. Under **2000+ req/min** sustained, expect **core/commerce/postgres/nginx** CPU to rise first; **set frontend memory limit** in compose so Node cannot starve others.

### 0.3 Error patterns in recent logs (`docker-compose logs --tail=120 | grep -iE error|…`)

| Service | Finding | Severity | Action |
|---------|---------|----------|--------|
| **core** | `redis.exceptions.TimeoutError: Timeout reading from socket` + `[EmailQueue] worker loop error` | **High** | Deploy **async OTP worker** (`email_queue.py`); rebuild **core**. Matches known sync-`blpop`-in-thread failure mode. |
| **postgres** | `FATAL: password authentication failed for user "postgres"` ~**every 5 minutes** | **High (security)** | **Firewall** port **6001** from the internet; fix wrong password in **cron/healthcheck**; scanners hit exposed Postgres. |
| **frontend** | `Collection not found` (metadata + data fetch) | **Low** | Bad slugs/bots; **slug guards** in uncommitted `collections/[slug]/page.js` reduce bad API calls after deploy. |
| **commerce / payment / admin / redis** | No error lines in last 120 lines | — | — |
| **nginx** | Lines matching `error` are often **chunk filenames** `app/error-*.js` (HTTP **200**) | Noise | Filter logs: exclude `/_next/static/` or require ` 5[0-9]{2} ` |

### 0.4 “Fix it on this VPS only” — minimum deploy checklist

1. **Commit** all intended changes (including **`guest_tracking_token.py`**, **`introVideoOverlayContext.jsx`**, **`scale_indexes.sql`**).
2. **`docker-compose build`** then **`docker-compose up -d`** (or `--build`).
3. **Apply** `docker/postgres/scale_indexes.sql` to **existing** DB if volume already initialized:  
   `docker-compose exec -T postgres psql -U postgres -d aarya_clothing < docker/postgres/scale_indexes.sql`
4. **Align Redis password:** `redis.conf` `requirepass` ↔ `.env` `REDIS_PASSWORD`.
5. **Close Postgres port** or **restrict firewall** for **6001**.
6. Re-run **`docker-compose logs core`** and confirm **OTP worker** no longer spams Redis timeouts.

---

## 1. Definitions (concurrency vs RPS vs users)

| Term | Meaning | Typical order of magnitude on your stack |
|------|---------|-------------------------------------------|
| **RPS** | HTTP requests finished per second | Commerce doc cited ~2.6 RPS average; peaks higher |
| **req/min** | RPS × 60 | ~150 req/min at 2.5 RPS; **2000 req/min ≈ 33 RPS** sustained |
| **Concurrent requests** | In flight at one instant | Depends on latency; at 33 RPS and 200 ms p99, rough concurrency ≈ 33 × 0.2 ≈ **7** (very rough) |
| **Concurrent users** | Humans with sessions; not 1:1 with HTTP requests | One user generates bursts of parallel API calls (HTML, JS, images, APIs) |

**Important:** “**2000+ concurrent requests**” as a steady load would imply extremely high RPS unless every request is multi‑second. Prefer to target **sustained RPS / req/min**, **p95/p99 latency**, and **error rate**. The master plan’s **~36 req/min peak** vs **2000+ req/min target** is a **~55×** throughput increase — achievable with **workers, pooling, caching, and DB tuning**, not only by “bigger VPS.”

---

## 2. Hardware assumption & headroom model

**Assumed production VPS (from your master plan):** ~**4 vCPU**, **16 GB RAM**, SSD.

### 2.1 Rough memory budget (containers)

| Area | Guideline |
|------|-----------|
| **OS + page cache** | Leave **2–4 GB** unallocated for kernel and filesystem cache |
| **Postgres** | `shared_buffers` + connections × `work_mem` peaks — **512 MB–2 GB** container limit depending on tuning |
| **Redis** | Plan for **maxmemory** + overhead (e.g. **256–512 MB** limit) |
| **Meilisearch** | **512 MB–1 GB** typical cap |
| **Each Python service** | **2 uvicorn workers** × (~150–300 MB) under load + spikes → **plan ~512 MB–1 GB per service** when tuning |
| **Next.js (Node)** | SSR spikes → **1–2 GB** cap is reasonable |
| **Nginx** | Small (**128–256 MB**) |

**Buffer rule of thumb:** After summing **limits**, keep **≥15–20% RAM free** for spikes and kernel; if you’re constantly above **80%** RAM, add swap (safety) **and** reduce workers or add PgBouncer / offload.

### 2.2 CPU

- **4 vCPUs** are **time-sliced** across all containers.
- **Uvicorn workers** increase parallelism but **do not create new cores**; under saturation, latency rises (queuing).
- **Nginx** is rarely the bottleneck at your scale; **Python + Postgres + Next SSR** usually are.

---

## 3. Uncommitted changes — inventory & risk

Below is derived from `git status` / `git diff --stat` on **development-branch**. **Commit or stash before production deploy** so rollbacks are clean.

**Latest stats (approx.):** **28 files changed**, **+392 / −347** lines.

**Untracked (must be added or they will not ship):**

- `services/commerce/service/guest_tracking_token.py`
- `frontend_new/lib/introVideoOverlayContext.jsx`
- `docker/postgres/scale_indexes.sql`
- `scripts/healthcheck.sh`
- `PRODUCTION_SCALING_MASTER_PLAN.md`, `VPS_DEEP_DIVE_SCALING_AND_UNCOMMITTED_ANALYSIS.md` (docs — optional in release)

### 3.1 Infrastructure & data layer

| Path | What it does | Risk / note |
|------|----------------|-------------|
| `docker-compose.yml` | Postgres tuning (`max_connections`, `shared_buffers`, …), frontend **deploy limits**, extra init **`scale_indexes.sql`** | **New DB only:** `02-scale-indexes.sql` runs on **first init**. **Existing volume:** apply SQL manually (see plan). |
| `docker/nginx/nginx.conf` | Global proxy timeouts; **rate limits** on HTTP :80 API paths | Validate **429** rates for real mobile clients (bursts). |
| `docker/redis/redis.conf` | **400mb**, **allkeys-lru** | **`requirepass` in file** may still **not match** `${REDIS_PASSWORD}` — **must align** or auth fails. |
| `docker/postgres/scale_indexes.sql` | Extra indexes | Safe **IF NOT EXISTS**; run on old DBs once. |
| `scripts/healthcheck.sh` | Host script | Low risk. |

### 3.2 Core — OTP & API process

| Path | What it does | Risk / note |
|------|----------------|-------------|
| `services/core/service/email_queue.py` | **Async Redis** OTP worker (fixes broken sync `blpop` after timeouts) | **High value** — should reduce OTP 500s under load. |
| `services/core/Dockerfile` | **Uvicorn multi-worker** | **Each worker** runs app lifespan (e.g. OTP worker task) — **multiple consumers** on same queue (OK for Redis list). |
| `services/core/database/database.py` | **pool_timeout**, **pool_recycle** | Fail-fast under pool exhaustion. |

### 3.3 Commerce, payment, admin

| Path | What it does | Risk / note |
|------|----------------|-------------|
| `services/commerce/main.py` (+ routes/schemas) | **Guest order tracking** `/api/v1/orders/track/{token}`, `joinedload`, guest token helper | **Route order** matters (`track` before `{order_id}`) — already commented in diff. Ensure **SECRET** for HMAC tokens in env. |
| `services/commerce/service/guest_tracking_token.py` | **Untracked** — new module | Must be **committed** for CI/CD. |
| `services/payment/service/payment_service.py` | Webhook **row locks** + idempotent skip if not `pending` | Reduces double capture vs client verify. |
| `services/*/Dockerfile`, `*/database/database.py` | Workers + pools | Payment DB now uses **shared pool settings** + `QueuePool`. |

### 3.4 Shared config

| Path | What it does | Risk / note |
|------|----------------|-------------|
| `shared/base_config.py` | **Smaller default pools** (5/10) | Reduces Postgres connection storms; **raise PgBouncer** before raising per-app pools blindly. |

### 3.5 Frontend (UX / performance)

| Path | What it does | Risk / note |
|------|----------------|-------------|
| `frontend_new/components/landing/IntroVideo.jsx` | **Click-to-play**, audio, simpler UI, skip position | Good for browser autoplay policy. |
| `frontend_new/lib/introVideoOverlayContext.jsx` | **Hides bottom nav + chat** during intro | Fixes z-index stacking; ensure **provider wraps** shell. |
| `frontend_new/components/common/BottomNavigation.jsx` | Uses overlay context | OK. |
| `frontend_new/components/chat/CustomerChatWidget.jsx` | Hides during intro | OK. |
| `frontend_new/app/layout.js` | **IntroVideoOverlayProvider** | Verify order: inside **SiteConfigProvider** / **ToastProvider** as intended. |
| `frontend_new/app/collections/[slug]/page.js` | **Slug guard** (`null` / `"null"`) | Stops bogus API calls. |
| `frontend_new/middleware.js` | JWT parsing hardening | Edge runtime — watch **CPU** on hot paths. |
| `frontend_new/app/products/[id]/page.js`, `profile/page.js`, `performance.js`, `Skeleton.jsx` | Misc UX/perf | Review for hydration and LCP. |

### 3.6 Docs / plans

| Path | Note |
|------|------|
| `PRODUCTION_SCALING_MASTER_PLAN.md` | Untracked — keep as internal runbook; **do not** treat as applied unless code matches. |

---

## 4. Architecture snapshot

```
                    [ Users ]
                        |
                   [ Cloudflare / DNS ]
                        |
                  [ Nginx :80 / :443 ]
                   /     |     \
            [ Next.js ] [ Core ] [ Commerce ]
                |          \      /     \
                |         [ Payment ]  [ Meilisearch ]
                |              |
           [ Redis ]    [ Postgres ]
         (DB 0–3)       (single instance)
```

- **Strengths:** Clear service boundaries, **Razorpay** webhooks + **payment audit** tables, **Redis** queues for OTP email, **rate limit zones** in nginx (expanded).
- **Weaknesses (scale):** **Single Postgres** write primary, **single Redis**, **no connection pooler** in prod yet (PgBouncer optional), **Next.js SSR** can spike CPU/RAM under load.

---

## 5. Bottlenecks & what already helps

| Layer | Bottleneck | Mitigations in repo / recent changes |
|-------|------------|--------------------------------------|
| **Postgres** | Connections, disk I/O, slow queries | Pool limits, **indexes** (`init.sql` + `scale_indexes.sql`), tuned `max_connections` |
| **Redis** | Memory, hot keys, eviction | **allkeys-lru**, higher **maxmemory** |
| **Core** | OTP + SMTP + auth | **Async email worker**, queue |
| **Commerce** | Heavy `main.py`, N+1 | **joinedload** on new track route; more routes should use **selectinload/joinedload** |
| **Payment** | Double processing | **SELECT FOR UPDATE**, webhook **idempotency** (`event_id` unique + skip) |
| **Edge** | nginx timeouts, abuse | **limit_req**, higher **proxy_read_timeout** |
| **Frontend** | SSR cost, bundle size | **dynamic import**, limits on API fan-out, CDN for static (optional) |

---

## 6. OTP, email queue, Redis, Postgres

### 6.1 OTP flow

1. API enqueues job (`try_enqueue_otp_email`) or sends sync if Redis down.
2. **Worker** (`run_otp_email_worker`) consumes via **BLPOP**.
3. **Async Redis** avoids the “broken connection after timeout” failure mode of sync `blpop` in a thread.

**Optimize further**

- **SMTP:** use a reputable relay; monitor **SMTP_SEND_MAX_ATTEMPTS** and queue depth (`LLEN`).
- **Horizontally:** multiple workers are OK; **do not** duplicate **cron-style** jobs without locks.

### 6.2 Postgres

- **Connection formula (rough):** apps × `(pool_size + max_overflow)` must stay **below** `max_connections` minus admin overhead.
- **Next step for big traffic:** **PgBouncer** in `transaction` mode + **lower per-app pools** → fewer server processes holding server connections.

### 6.3 Redis

- Align **`requirepass`** in `redis.conf` with **`REDIS_PASSWORD`** in compose — **critical** for production.
- Monitor: **used_memory**, **evicted_keys**, **blocked_clients** (BLPOP).

---

## 7. Payments (Razorpay) — idempotency & races

- **Client verify:** `verify_payment` uses **`with_for_update`** on internal transaction row.
- **Webhook:** capture handler now uses **row-level lock** and **skips** if already non-pending.
- **Webhook events:** **`event_id` unique** + “already processed” short-circuit.

**Still monitor:** commerce **order creation** from webhook vs checkout race — recovery jobs exist for orphans.

---

## 8. Frontend & edge (Next.js, nginx)

- **Intro video:** context hides chrome; reduces accidental taps on **bottom nav** during overlay.
- **Middleware:** stricter JWT parsing — watch **Edge CPU** if you add heavy logic.
- **Nginx:** rate limits protect auth — tune **burst** if legitimate users hit **429** during spikes.

---

## 9. Logging & observability — current vs recommended

### 9.1 What you likely have today

- **Container stdout/stderr** via `docker logs`.
- **Application logs** in Python (INFO/ERROR).
- **Web vitals** endpoint pushing to Redis list (core) — good for sampling, not a full APM.

### 9.2 Gaps for “big site” operations

| Gap | Recommendation |
|-----|------------------|
| **Centralized logs** | **Loki** + Promtail, or **journald** + forwarder, or managed (Datadog, CloudWatch if on AWS) |
| **Metrics** | **Prometheus** + **node_exporter** + **postgres_exporter** + **redis_exporter** |
| **Dashboards** | Grafana |
| **Tracing** | OpenTelemetry for FastAPI/Next (later phase) |
| **Uptime** | Healthchecks from outside (UptimeRobot, etc.) |
| **Alerts** | Alertmanager or SaaS on **5xx rate**, **queue depth**, **Postgres connections** |

### 9.3 Log queries to run on VPS (see §15)

- **5xx** spikes in nginx `error.log`
- **OTP** / **SMTP** errors in **core**
- **Payment** webhook processing errors
- **Postgres:** `pg_stat_activity`, slow queries

---

## 10. Do you need ECS / Kubernetes?

### 10.1 When **single VPS + Docker Compose** is enough

- Traffic in the **hundreds–low thousands RPS** at the **edge** (nginx) with **efficient APIs** — your **bottleneck will be DB and app code**, not orchestration.
- Team size small; **one** production environment.
- You accept **vertical scaling** (bigger VPS) and **maintenance windows**.

### 10.2 When **ECS / EKS / GKE** becomes justified

- **Multiple AZ** high availability, **zero-downtime** deploys at scale.
- **Auto-scaling** groups for stateless services (API, Next) **separately** from stateful (Postgres, Redis — usually **managed RDS / ElastiCache**).
- **Several environments** (staging/prod) with GitOps.

**Migration path:** **Compose on one VPS →** add **managed Postgres/Redis →** split stateless services to **ECS/Fargate** or **K8s**; don’t jump to K8s with a single DB on the same VM — you’ll still have a **single point of failure**.

---

## 11. Phased roadmap (single VPS first)

### Phase A — Stabilize (now)

- [ ] Commit all changes; deploy to staging.
- [ ] Align **Redis password** file vs env.
- [ ] Apply **`scale_indexes.sql`** to existing DB if not fresh volume.
- [ ] Run §15 log commands; fix top errors.

### Phase B — Throughput (weeks)

- [ ] **PgBouncer** + reduce app pool sizes.
- [ ] **Load test** (k6/Locust) against **auth**, **browse**, **checkout** — define **SLO** (e.g. p95 < 500 ms for browse).
- [ ] **CDN** for Next static assets (if not already behind Cloudflare caching rules).

### Phase C — Observability

- [ ] Prometheus + Grafana on same VPS **or** hosted metrics.
- [ ] Log aggregation + retention policy.

### Phase D — Scale out (only if Phase B maxes single machine)

- [ ] Read replica or **managed Postgres**.
- [ ] Separate **Next** servers behind load balancer.
- [ ] Consider **K8s/ECS** for **stateless** tier only.

---

## 12. Structural / code-quality watchlist

| Item | Why it matters at scale |
|------|-------------------------|
| **Large `commerce/main.py`** | Hard to test and reason about; continue **splitting routes** (already partially modular). |
| **N+1 queries** | Use **joinedload/selectinload** consistently in hot paths. |
| **Synchronous SMTP in worker** | OK in worker; **never** in request path for OTP when queue enabled. |
| **Payment + commerce coupling** | HTTP internal calls on webhook — add **timeouts**, **retries**, **idempotency keys** on order create. |
| **Secrets in redis.conf** | Remove hardcoded passwords from repo; use templates or Docker secrets. |

---

## 13. 2000+ “things” — realistic targets

| Goal | Realistic interpretation | Action |
|------|---------------------------|--------|
| **2000+ req/min** | ~33 RPS | Achievable on tuned 4 vCPU with caching + pools |
| **2000 concurrent users online** | Low average RPS per user | Mostly **session + browse**; still need **CDN + cache** |
| **2000 concurrent HTTP requests** | Very high | Usually implies **many seconds** per request or **huge** RPS — **measure** with load tests |

---

## 14. Buffer & relaxation strategy

1. **Capacity:** Target **≤70%** sustained CPU and **≤75%** RAM under **peak test load**; leave **20–30%** headroom.
2. **Rate limits:** High enough **burst** for mobile (parallel API calls); use **429** JSON body with retry hints.
3. **Queues:** OTP email queue absorbs SMTP latency — **monitor depth**.
4. **DB:** Avoid **max_connections** exhaustion — **PgBouncer** before raising limits blindly.
5. **Swap:** **4 GB swap** as safety net (not performance — prevents OOM kill during spikes).

---

## 15. Commands to run on the VPS (logs, stats, errors)

Run from the repo directory; **prefer `docker-compose`** on this host. **Redact secrets** before sharing.

```bash
cd /opt/Aarya_clothing_frontend   # or your deploy path

# Status & resource snapshot
docker-compose ps
docker stats --no-stream

# Per-service errors (last 120 lines)
for s in core commerce payment admin nginx frontend postgres redis; do
  echo "======== $s ========"
  docker-compose logs --tail=120 "$s" 2>&1 | grep -iE 'error|exception|fatal|traceback|FATAL|timeout|failed' || true
done

# Nginx error log inside container (path may vary)
docker exec aarya_nginx sh -c 'tail -n 100 /var/log/nginx/error.log' 2>/dev/null || true

# Postgres connections
docker-compose exec -T postgres psql -U postgres -d aarya_clothing -c \
  "SELECT count(*) AS connections, state FROM pg_stat_activity GROUP BY state;"

# Redis memory (set REDIS_PASSWORD from .env)
docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" INFO memory 2>/dev/null | head -40
```

**Interpretation**

- Repeated **Redis auth errors** → password mismatch between **config file** and **env**.
- **Postgres** `too many connections` → pools too high or need **PgBouncer**.
- **nginx** `upstream timed out` → increase timeouts or fix slow app/DB.
- **Core** SMTP errors → provider rate limits or bad credentials.

---

## Summary

- **Uncommitted work** spans **infra, OTP worker, pools, workers, payment locking, guest tracking, intro UX, middleware** — **commit and test** as one release candidate.
- **This VPS can carry large traffic** if you define **RPS/latency SLOs**, keep **buffer**, fix **Redis auth alignment**, and add **observability**.
- **ECS/Kubernetes** is **not** required to go from tens to **hundreds of RPS**; it’s for **HA, fleet ops, and multi-node** scale-out — **after** DB and app efficiency are proven.
- **Docker logs** must be collected **on the server** — this analysis cannot replace that step.

---

*Generated as a planning document. Update numbers (CPU/RAM) when your production SKU differs.*
