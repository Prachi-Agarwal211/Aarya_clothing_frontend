# Deployment & Operations Guide

**Last Updated:** April 8, 2026  
**Production URL:** https://aaryaclothing.in  
**Stack:** Next.js 15 + Python FastAPI + PostgreSQL + Docker

---

## Quick Reference

| Service | Container | Port | Health Check |
|---------|-----------|------|--------------|
| PostgreSQL | `aarya_postgres` | 6001 | `docker exec aarya_postgres pg_isready` |
| Redis | `aarya_redis` | 6379 | `docker exec aarya_redis redis-cli ping` |
| Core API | `aarya_core` | 5001 | `curl http://localhost:5001/health` |
| Commerce | `aarya_commerce` | 5002 | `curl http://localhost:5002/health` |
| Payment | `aarya_payment` | 5003 | `curl http://localhost:5003/health` |
| Admin | `aarya_admin` | 5004 | N/A |
| Frontend | `aarya_frontend` | 6004 | `curl http://localhost:6004` |
| Nginx | `aarya_nginx` | 80, 443 | `curl -I https://aaryaclothing.in` |

---

## Pre-Deployment Checklist

### Critical (DO NOT DEPLOY IF ANY FAIL)

- [ ] **No database schema changes required** - Zero changes to `migrations/` or `docker/postgres/`
- [ ] **All API calls backward compatible** - No breaking changes to response format
- [ ] **Error handling prevents crashes** - All async operations wrapped in try-catch
- [ ] **Rollback procedure ready** - Previous commit recorded, backup created

### Verify Before Deployment

```bash
# 1. Check current commit
cd /opt/Aarya_clothing_frontend
git log -1 --oneline
# Record this: _______________

# 2. Create database backup
docker exec aarya_postgres pg_dump -U postgres aarya_clothing > \
  /opt/backups/aarya_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Verify no schema changes
git diff HEAD~5 -- migrations/ docker/postgres/init.sql | wc -l
# Expected: 0

# 4. Check current container health
docker ps --filter "name=aarya" --format "table {{.Names}}\t{{.Status}}"
# Expected: All "Up" with "(healthy)"
```

---

## Deployment Steps

### Full Deployment (All Services)

```bash
cd /opt/Aarya_clothing_frontend

# 1. Pull latest code
git pull origin main

# 2. Build changed services
docker-compose build payment commerce frontend

# 3. Restart services
docker-compose up -d

# 4. Verify
docker-compose ps
curl -I https://aaryaclothing.in
```

### Frontend-Only Deployment (Most Common)

```bash
cd /opt/Aarya_clothing_frontend

# 1. Pull code
git pull origin main

# 2. Build frontend
docker-compose build frontend

# 3. Restart frontend only (zero downtime for other services)
docker-compose up -d --no-deps frontend

# 4. Watch logs (Ctrl+C when ready)
docker logs -f aarya_frontend
```

### Database Migration

```bash
# Run specific migration
docker exec -i aarya_postgres psql -U postgres -d aarya_clothing < \
  /opt/Aarya_clothing_frontend/migrations/migration_file.sql

# Verify migration
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c \
  "\dt"  # List tables
```

---

## Post-Deployment Verification

### Immediate (First 5 Minutes)

```bash
# Site responds
curl -I https://aaryaclothing.in
# Expected: HTTP/2 200

# API works
curl -s "https://aaryaclothing.in/api/v1/products?limit=1" | jq '.total'
# Expected: Number

# No critical errors
docker logs aarya_frontend --tail 50 | grep -i "error"

# All containers healthy
docker ps --filter "name=aarya" --format "table {{.Names}}\t{{.Status}}"
```

### Manual Testing (First 15 Minutes)

- [ ] Homepage loads
- [ ] Product page loads (test 2-3 products)
- [ ] Add to cart works
- [ ] Checkout page loads
- [ ] Payment gateway loads (Razorpay)
- [ ] Admin panel accessible (`/admin/products`)

### Monitoring (First 24 Hours)

```bash
# Watch for errors
docker logs -f aarya_frontend | grep -i "error"

# Check payment success rate
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "
  SELECT payment_method, COUNT(*), 
    COUNT(*) FILTER (WHERE status = 'confirmed') as successful,
    ROUND(COUNT(*) FILTER (WHERE status = 'confirmed') * 100.0 / COUNT(*), 2) as success_rate
  FROM orders WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY payment_method;
"
```

---

## Rollback Procedure

### Emergency Rollback (< 1 Minute)

```bash
cd /opt/Aarya_clothing_frontend

# 1. Stop the problematic container
docker stop aarya_frontend

# 2. Revert to last known good commit
git reset --hard <previous-commit-hash>

# 3. Rebuild and restart
docker-compose build frontend
docker-compose up -d --no-deps frontend

# 4. Verify
curl -I https://aaryaclothing.in
# Expected: HTTP/2 200
```

### Database Rollback

```bash
# 1. Stop services that write to database
docker-compose stop frontend admin

# 2. Restore from backup
docker exec -i aarya_postgres psql -U postgres -d aarya_clothing < \
  /opt/backups/aarya_backup_YYYYMMDD_HHMMSS.sql

# 3. Restart services
docker-compose start frontend admin

# 4. Verify
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c \
  "SELECT COUNT(*) FROM orders;"
```

### Rollback Decision Matrix

| Issue | Response | Action |
|-------|----------|--------|
| Site returns 500 errors | IMMEDIATE | Rollback immediately |
| Checkout not working | < 5 min | Rollback if fix > 10 min |
| Payment failures > 5% | IMMEDIATE | Rollback + contact Razorpay |
| Database connection errors | IMMEDIATE | Rollback + restore backup |
| Admin panel broken | < 30 min | Fix forward (customers OK) |
| UI glitches | < 1 hour | Fix forward if minor |

---

## Useful Commands

### Container Management

```bash
# Check all containers
docker ps --filter "name=aarya" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Restart specific service
docker-compose restart frontend

# View logs (last 100 lines)
docker logs aarya_frontend --tail 100

# View live logs
docker logs -f aarya_frontend

# Check resource usage
docker stats aarya_frontend aarya_commerce aarya_postgres
```

### Database Access

```bash
# Connect to database
docker exec -it aarya_postgres psql -U postgres -d aarya_clothing

# Common queries
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM products;

# Check recent orders
SELECT id, user_id, total_amount, payment_method, status, created_at 
FROM orders ORDER BY created_at DESC LIMIT 10;

# Exit
\q
```

### Service Health Checks

```bash
# Core API
curl http://localhost:5001/health

# Commerce
curl http://localhost:5002/health

# Payment
curl http://localhost:5003/health

# Frontend
curl -I http://localhost:6004

# Production site
curl -I https://aaryaclothing.in
```

---

## Environment Variables

Key variables in `.env` file:

```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=aarya_clothing
DB_USER=postgres
DB_PASSWORD=***

# Payment (Razorpay only - Cashfree disabled)
RAZORPAY_KEY_ID=***
RAZORPAY_KEY_SECRET=***
RAZORPAY_WEBHOOK_SECRET=***

# Service URLs
CORE_SERVICE_URL=http://core:5001
COMMERCE_SERVICE_URL=http://commerce:5002
PAYMENT_SERVICE_URL=http://payment:5003
```

---

## Troubleshooting

### Frontend Issues

| Issue | Solution |
|-------|----------|
| Site returns 502/503 | Check `docker logs aarya_frontend` |
| Page loads slowly | Check `docker stats` for resource limits |
| API calls fail | Verify backend services are running |
| Images broken | Check R2 URLs and CORS |

### Backend Issues

| Issue | Solution |
|-------|----------|
| Service not starting | Check `docker-compose logs <service>` |
| Database connection fails | Verify `DB_HOST`, `DB_PORT` in `.env` |
| Payment fails | Check Razorpay credentials and webhook |

### Database Issues

| Issue | Solution |
|-------|----------|
| Connection refused | Check PostgreSQL is running: `docker ps \| grep postgres` |
| Query slow | Run `EXPLAIN ANALYZE <query>` |
| Disk full | Check volume usage: `docker system df` |

---

## Monitoring Queries

### Payment Success Rate (Last 30 Days)

```sql
SELECT 
    payment_method,
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status IN ('confirmed', 'paid')) as successful,
    ROUND(
        COUNT(*) FILTER (WHERE status IN ('confirmed', 'paid')) * 100.0 / COUNT(*), 
        2
    ) as success_rate_percent
FROM orders 
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY payment_method;
```

### Orders Without Payment Transactions

```sql
SELECT o.id, o.user_id, o.total_amount, o.transaction_id
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id
WHERE pt.id IS NULL AND o.payment_method = 'razorpay'
ORDER BY o.created_at DESC;
```

### Revenue by Payment Method

```sql
SELECT 
    payment_method,
    COUNT(*) as order_count,
    SUM(total_amount) as total_revenue,
    AVG(total_amount) as avg_order_value
FROM orders 
WHERE status != 'cancelled'
GROUP BY payment_method;
```
