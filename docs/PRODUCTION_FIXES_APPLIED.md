# Production Fixes Applied

**Date:** 2026-04-12
**Target:** aaryaclothing.in
**Status:** All 7 fixes implemented, ready for deployment

---

## Summary of All Fixes

| # | Fix | Priority | File(s) Changed | Status |
|---|-----|----------|-----------------|--------|
| 1 | HTTP→HTTPS Redirect | CRITICAL | `docker/nginx/nginx.conf` | Done |
| 2 | PgBouncer MD5 Auth | CRITICAL | `docker/pgbouncer/userlist.txt`, `docker/pgbouncer/pgbouncer.ini` | Done |
| 3 | SSL Auto-Renewal | HIGH | `scripts/ssl-renew.sh` (new), system crontab | Done |
| 4 | Order Idempotency Lock | HIGH | `services/commerce/service/order_service.py` | Done |
| 5 | Meilisearch Production | MEDIUM | `docker-compose.yml` | Done |
| 6 | Workers 3→4 | HIGH | All 4 service Dockerfiles | Done |
| 7 | Redis Password Consistency | MEDIUM | `docker-compose.yml` | Done |

---

## FIX 1: HTTP → HTTPS Redirect

**File:** `docker/nginx/nginx.conf`

**What changed:**
- Added `map` directive at http level to detect internal Docker network requests (172.x, 10.x)
- Updated `location /` in HTTP server block to redirect external requests to HTTPS while serving internal SSR requests directly

**Before:** All HTTP requests served content over plaintext
**After:** External requests get `301 → https://`, internal Docker SSR requests served directly

**Testing:**
```bash
# Validate nginx config syntax
docker-compose exec nginx nginx -t

# Test external HTTP redirect (from browser/internet)
curl -I http://aaryaclothing.in
# Expected: HTTP/1.1 301 Moved Permanently, Location: https://aaryaclothing.in/

# Test internal Docker SSR still works (from frontend container)
docker exec aarya_frontend curl -s http://nginx:80/ | head -5
# Expected: HTML content from Next.js
```

**Deploy:**
```bash
docker-compose up -d --no-deps nginx
```

---

## FIX 2: PgBouncer MD5 Authentication

**Files:** `docker/pgbouncer/userlist.txt`, `docker/pgbouncer/pgbouncer.ini`

**What changed:**
- `pgbouncer.ini`: Changed `auth_type` from `scram-sha-256` to `md5`
- `userlist.txt`: Generated proper MD5 hash for postgres user
  - Hash: `md5` + md5("postgres123" + "postgres") = `md5163311300b0732b814a34aabfdfffe62`

**Before:** SASL authentication failing (scram-sha-256 with empty userlist.txt)
**After:** MD5 authentication with proper hash in userlist.txt

**Testing:**
```bash
# Rebuild and restart PgBouncer
docker-compose up -d --build pgbouncer

# Test connection through PgBouncer
docker-compose exec pgbouncer pg_isready -h localhost -p 6432 -U postgres

# Test actual DB connection via PgBouncer
docker-compose run --rm core python -c "
import os
from sqlalchemy import create_engine
engine = create_engine(os.environ['DATABASE_URL'].replace('@postgres:', '@pgbouncer:'))
print(engine.connect().scalar('SELECT 1'))
"
```

**Deploy:**
```bash
docker-compose up -d --build pgbouncer
```

---

## FIX 3: SSL Auto-Renewal

**File:** `scripts/ssl-renew.sh` (new), system crontab

**What changed:**
- Created automated SSL renewal script that runs certbot and reloads nginx
- Added cron job: `0 2 * * *` (daily at 2 AM)

**Before:** Manual certificate renewal required
**After:** Automatic renewal with logging to `/var/log/ssl-renew.log`

**Testing:**
```bash
# Test script manually (dry run)
/opt/Aarya_clothing_frontend/scripts/ssl-renew.sh

# Check cron entry
crontab -l | grep ssl-renew

# Check certbot certificates
docker-compose run --rm certbot certificates
```

**Deploy:**
```bash
# Script is already active via cron, no service restart needed
# To test immediately:
/opt/Aarya_clothing_frontend/scripts/ssl-renew.sh
```

---

## FIX 4: Row-Level Lock on Order Idempotency

**File:** `services/commerce/service/order_service.py`

**What changed:**
- Added `.with_for_update(nowait=True)` to the idempotency check query
- Prevents race condition where concurrent duplicate requests create duplicate orders

**Before:** `SELECT ... WHERE transaction_id = ?` (no lock)
**After:** `SELECT ... WHERE transaction_id = ? FOR UPDATE NOWAIT` (row-level lock)

**Testing:**
```bash
# Rebuild commerce service
docker-compose up -d --build commerce

# Verify the change is deployed
docker exec aarya_commerce grep -A2 "with_for_update" /app/service/order_service.py
```

**Deploy:**
```bash
docker-compose up -d --build commerce
```

---

## FIX 5: Meilisearch Production Mode

**File:** `docker-compose.yml`

**What changed:**
- `MEILI_ENV`: `development` → `production`
- `MEILI_MASTER_KEY`: `${MEILI_MASTER_KEY:-dev_master_key}` → `${MEILI_MASTER_KEY}` (no fallback)

**Before:** Development mode with default key
**After:** Production mode requiring explicit master key from .env

**Testing:**
```bash
# Verify Meilisearch is running in production mode
docker exec aarya_meilisearch curl -s http://localhost:7700/health
# Expected: {"status":"available"}

# Check master key is required (should fail without key)
docker exec aarya_meilisearch curl -s http://localhost:7700/keys
# Should return 401 if no key provided
```

**Deploy:**
```bash
docker-compose up -d meilisearch
```

---

## FIX 6: Increase Workers to 4

**Files:** `services/core/Dockerfile`, `services/commerce/Dockerfile`, `services/payment/Dockerfile`, `services/admin/Dockerfile`

**What changed:**
- All 4 services: `UVICORN_WORKERS=3` → `UVICORN_WORKERS=4`

**Before:** 3 workers per service (12 total across 4 services)
**After:** 4 workers per service (16 total across 4 services)

**Testing:**
```bash
# Rebuild all services
docker-compose up -d --build core commerce payment admin

# Verify worker count in each service
for svc in core commerce payment admin; do
  echo "=== $svc ==="
  docker exec aarya_$svc sh -c 'echo $UVICORN_WORKERS'
done
```

**Deploy:**
```bash
docker-compose up -d --build core commerce payment admin
```

---

## FIX 7: Redis Password Consistency

**File:** `docker-compose.yml`

**What changed:**
- Removed all `${REDIS_PASSWORD:-aarya_clothing_redis_password_2024}` fallback defaults
- Now uses `${REDIS_PASSWORD}` which requires the value from .env
- .env already contains correct password: `7v_CnHVZO97-fvFu9p8yNPHUAxrDb4puqcY662tTohs`

**Before:** 8 instances of hardcoded fallback password in docker-compose.yml
**After:** All use `${REDIS_PASSWORD}` from .env (no fallback)

**Testing:**
```bash
# Verify .env has correct password
grep REDIS_PASSWORD .env

# Verify redis connectivity
docker-compose exec redis redis-cli -a "$(grep REDIS_PASSWORD .env | cut -d= -f2)" ping
# Expected: PONG
```

**Deploy:**
```bash
docker-compose up -d redis core commerce payment admin payment-worker
```

---

## Full Deployment Commands

### Option A: Full Rebuild (Recommended)
```bash
cd /opt/Aarya_clothing_frontend

# Stop all services
docker-compose down

# Rebuild and start everything
docker-compose up -d --build

# Verify all services healthy
docker-compose ps
```

### Option B: Incremental Deploy
```bash
cd /opt/Aarya_clothing_frontend

# Deploy in dependency order
docker-compose up -d meilisearch
docker-compose up -d --build pgbouncer
docker-compose up -d redis core commerce payment admin
docker-compose up -d --build nginx
docker-compose up -d --build payment-worker
```

---

## Rollback Plan

If something breaks after deployment:

### Immediate Rollback (git revert)
```bash
cd /opt/Aarya_clothing_frontend

# Revert all changes
git checkout HEAD -- docker/nginx/nginx.conf
git checkout HEAD -- docker/pgbouncer/userlist.txt
git checkout HEAD -- docker/pgbouncer/pgbouncer.ini
git checkout HEAD -- docker-compose.yml
git checkout HEAD -- services/core/Dockerfile
git checkout HEAD -- services/commerce/Dockerfile
git checkout HEAD -- services/payment/Dockerfile
git checkout HEAD -- services/admin/Dockerfile
git checkout HEAD -- services/commerce/service/order_service.py

# Remove SSL cron entry (optional)
crontab -l | grep -v ssl-renew | crontab -

# Remove SSL script (optional)
rm scripts/ssl-renew.sh

# Rebuild and restart
docker-compose up -d --build
```

### Per-Fix Rollback
```bash
# FIX 1 (nginx): Revert nginx.conf and restart
git checkout HEAD -- docker/nginx/nginx.conf
docker-compose up -d nginx

# FIX 2 (PgBouncer): Revert userlist.txt and pgbouncer.ini
git checkout HEAD -- docker/pgbouncer/userlist.txt
git checkout HEAD -- docker/pgbouncer/pgbouncer.ini
docker-compose up -d --build pgbouncer

# FIX 4 (order_service.py): Revert Python change
git checkout HEAD -- services/commerce/service/order_service.py
docker-compose up -d --build commerce

# FIX 6 (workers): Revert all Dockerfiles
git checkout HEAD -- services/*/Dockerfile
docker-compose up -d --build core commerce payment admin
```

---

## Files Changed (Complete List)

1. `docker/nginx/nginx.conf` — HTTP→HTTPS redirect with map directive
2. `docker/pgbouncer/userlist.txt` — Generated MD5 hash for postgres user
3. `docker/pgbouncer/pgbouncer.ini` — Changed auth_type to md5
4. `docker-compose.yml` — Meilisearch production mode + Redis password consistency
5. `services/commerce/service/order_service.py` — Row-level lock on idempotency check
6. `services/core/Dockerfile` — UVICORN_WORKERS=4
7. `services/commerce/Dockerfile` — UVICORN_WORKERS=4
8. `services/payment/Dockerfile` — UVICORN_WORKERS=4
9. `services/admin/Dockerfile` — UVICORN_WORKERS=4
10. `scripts/ssl-renew.sh` — NEW: SSL auto-renewal script

---

## Post-Deployment Verification Checklist

```bash
# 1. All services running
docker-compose ps

# 2. Health checks passing
docker-compose exec core curl -s http://localhost:5001/health
docker-compose exec commerce curl -s http://localhost:5002/health
docker-compose exec payment curl -s http://localhost:5003/health
docker-compose exec admin curl -s http://localhost:5004/health

# 3. HTTP→HTTPS redirect
curl -I http://aaryaclothing.in  # Should 301 to https

# 4. PgBouncer connection
docker-compose exec pgbouncer pg_isready -h localhost -p 6432 -U postgres

# 5. Redis connectivity
docker-compose exec redis redis-cli -a "$(grep REDIS_PASSWORD .env | cut -d= -f2)" ping

# 6. SSL certificate
docker-compose run --rm certbot certificates

# 7. Nginx config test
docker-compose exec nginx nginx -t
```
