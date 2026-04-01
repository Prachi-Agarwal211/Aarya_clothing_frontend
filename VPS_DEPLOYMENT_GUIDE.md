# VPS Production Deployment Guide

**⚠️ CRITICAL: This is a PRODUCTION environment with real transactions and customer data.**

**Last Updated:** April 1, 2026  
**Production URL:** https://aaryaclothing.in  
**Current Branch:** `development-branch`  
**Last Commit:** `43f0891` - Next.js 15 metadata fix

---

## 🚨 Environment Architecture

### Current Setup
- **Development:** Direct on VPS (no staging environment)
- **Testing:** Live production site (aaryaclothing.in)
- **Deployment:** Docker Compose on VPS
- **Database:** PostgreSQL with real customer data
- **Transactions:** Live payment processing (Razorpay)

### Running Services
```
Service          Port    Status
─────────────────────────────────────────
aarya_frontend   6004    Customer-facing site
aarya_admin      5004    Admin panel
aarya_commerce   5002    Commerce API
aarya_payment    5003    Payment processing
aarya_core       5001    Core services
aarya_nginx      80/443  Reverse proxy + SSL
aarya_postgres   6001    Database
aarya_redis      6002    Cache/sessions
aarya_meilisearch 6003   Search engine
```

---

## 📋 Pre-Deployment Verification

### Step 1: Verify Current Production State

```bash
# 1. Check all containers are running healthy
docker ps --filter "name=aarya" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Expected: All 9 containers showing "Up" with "(healthy)" status

# 2. Verify current git branch
cd /opt/Aarya_clothing_frontend
git branch --show-current
# Expected: development-branch

# 3. Check last deployed commit
git log -1 --oneline
# Record this for rollback reference

# 4. Verify production site is responding
curl -I https://aaryaclothing.in
# Expected: HTTP/2 200

# 5. Verify API is responding
curl -s "https://aaryaclothing.in/api/v1/products?limit=1" | jq '.total'
# Expected: Number (current: 9 products)

# 6. Check recent orders (last 7 days)
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c \
  "SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '7 days';"
# Record this number for post-deployment verification
```

### Step 2: Verify Changes Are VPS-Safe

```bash
# Check what files have been modified
git status --short

# Verify NO changes to infrastructure files
git diff HEAD~5 -- docker-compose.yml docker-compose.dev.yml docker/ .env.example
# Expected: 0 lines (no changes)

# Verify NO database migrations
git diff HEAD~5 -- migrations/ database/
# Expected: 0 lines (no changes)

# All changes MUST be in frontend_new/ only
git diff HEAD~5 --name-only | grep -v "^frontend_new/"
# Expected: No output (all changes in frontend_new/)
```

### Step 3: Create Backup (MANDATORY)

```bash
# 1. Create database backup
docker exec aarya_postgres pg_dump -U postgres aarya_clothing > \
  /opt/backups/aarya_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Record current git commit for rollback
git rev-parse HEAD > /opt/backups/current_commit_$(date +%Y%m%d_%H%M%S).txt

# 3. Verify backup was created
ls -lh /opt/backups/
```

---

## 🚀 Safe Deployment Procedure

### Method A: Zero-Downtime Deployment (RECOMMENDED)

```bash
# 1. Navigate to project directory
cd /opt/Aarya_clothing_frontend

# 2. Pull latest changes
git pull origin development-branch

# 3. Build new frontend image (does NOT affect running containers)
docker-compose build frontend

# 4. Verify build succeeded
docker images | grep aarya_clothing_frontend | head -2
# Should show both old and new images

# 5. Test build in isolated container
docker run --rm --network aarya_clothing_default \
  $(docker images -q aarya_clothing_frontend | head -1) \
  node -e "console.log('Build OK')"

# 6. Restart frontend only (other services continue running)
docker-compose up -d --no-deps frontend

# 7. Watch startup logs
docker logs -f aarya_frontend

# 8. Wait for "Ready in Xms" message
# Expected: "✓ Ready in XXXXms"
```

### Method B: Full Redeployment (If Method A Fails)

```bash
# 1. Stop all services
docker-compose down

# 2. Rebuild all images
docker-compose build

# 3. Start all services
docker-compose up -d

# 4. Verify all containers are healthy
watch 'docker ps --filter "name=aarya" --format "{{.Names}}\t{{.Status}}"'

# 5. Check frontend logs
docker logs -f aarya_frontend
```

---

## ✅ Post-Deployment Verification

### Immediate Checks (First 5 Minutes)

```bash
# 1. Verify site is responding
curl -I https://aaryaclothing.in
# Expected: HTTP/2 200

# 2. Check Next.js cache is working
curl -sI https://aaryaclothing.in | grep x-nextjs-cache
# Expected: HIT (after first request)

# 3. Verify API is responding
curl -s "https://aaryaclothing.in/api/v1/products?limit=1" | jq '.items | length'
# Expected: 1

# 4. Check for errors in logs
docker logs --tail 100 aarya_frontend | grep -i error
# Expected: No critical errors

# 5. Verify all containers healthy
docker ps --filter "name=aarya" --format "{{.Names}}\t{{.Status}}"
# Expected: All showing "(healthy)"
```

### Critical Path Testing (First 15 Minutes)

**Customer-Facing Tests:**

1. **Homepage**
   - [ ] https://aaryaclothing.in loads correctly
   - [ ] Hero section displays
   - [ ] New arrivals section shows products
   - [ ] Collections section displays
   - [ ] No console errors (check browser DevTools)

2. **Product Pages**
   - [ ] Product detail page loads
   - [ ] Product images display correctly
   - [ ] Size selection works
   - [ ] "Add to Cart" button functional
   - [ ] Related products display

3. **Collection Pages**
   - [ ] Collection listing page loads
   - [ ] Filter functionality works
   - [ ] Product grid displays correctly
   - [ ] Pagination works

4. **Cart Operations**
   - [ ] Add product to cart
   - [ ] Cart count updates
   - [ ] Cart page displays correctly
   - [ ] Quantity update works
   - [ ] Remove item works

5. **Checkout Flow** ⚠️ CRITICAL - Use Test Mode
   - [ ] Checkout page loads
   - [ ] Address form works
   - [ ] Payment gateway loads (Razorpay test mode)
   - [ ] **Complete a test transaction with real payment**
   - [ ] Order confirmation displays
   - [ ] Order confirmation email received

6. **User Authentication**
   - [ ] Login works
   - [ ] Logout works
   - [ ] Password reset flow works
   - [ ] OTP delivery works (email)

**Admin Panel Tests:**

1. **Admin Access**
   - [ ] https://aaryaclothing.in/admin loads
   - [ ] Login successful
   - [ ] Dashboard displays metrics

2. **Order Management**
   - [ ] Order list displays
   - [ ] Order details viewable
   - [ ] Status update works
   - [ ] Invoice generation works

3. **Product Management**
   - [ ] Product list displays
   - [ ] Product edit page loads
   - [ ] Product update saves correctly
   - [ ] Image upload works

### Database Verification

```bash
# 1. Verify order count matches pre-deployment
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c \
  "SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '7 days';"
# Should match pre-deployment count (+ any new test orders)

# 2. Check for any failed transactions
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c \
  "SELECT COUNT(*) FROM payment_transactions WHERE status = 'failed';"
# Review any new failures

# 3. Verify no database errors
docker logs aarya_postgres | tail -50 | grep -i error
# Expected: No new errors
```

---

## 🔄 Rollback Procedure

### Immediate Rollback (< 1 minute)

**If critical issues detected after deployment:**

```bash
# OPTION 1: Revert to previous Docker image
docker-compose up -d --no-deps frontend --force-recreate

# OPTION 2: Revert git and rebuild
cd /opt/Aarya_clothing_frontend
git revert HEAD
docker-compose build frontend
docker-compose up -d --no-deps frontend

# OPTION 3: Restore from backup (nuclear option)
# 1. Find backup file
ls -lt /opt/backups/*.sql | head -1

# 2. Restore database
docker exec -i aarya_postgres psql -U postgres aarya_clothing < \
  /opt/backups/aarya_backup_YYYYMMDD_HHMMSS.sql

# 3. Restore git to previous commit
cd /opt/Aarya_clothing_frontend
git reset --hard <previous-commit-hash>

# 4. Rebuild and restart
docker-compose build frontend
docker-compose up -d --no-deps frontend
```

### Rollback Decision Matrix

| Issue Severity | Response Time | Action |
|----------------|---------------|--------|
| Site down (500 errors) | Immediate | Rollback immediately |
| Checkout broken | < 5 minutes | Rollback if fix > 10 min |
| UI glitches | < 30 minutes | Fix forward if minor |
| Performance degradation | < 1 hour | Investigate, rollback if critical |
| Admin panel issues | < 2 hours | Fix forward (customers unaffected) |

---

## 🛡️ Safety Rules

### NEVER Deploy Without:

1. ✅ **Database backup created** (within last hour)
2. ✅ **Git commit hash recorded** (for rollback)
3. ✅ **Pre-deployment verification completed** (all checks pass)
4. ✅ **Test transaction completed** (real payment in test mode)
5. ✅ **Rollback procedure reviewed** (team knows steps)

### NEVER Deploy During:

1. ❌ **Peak hours** (10 AM - 10 PM IST) unless critical security fix
2. ❌ **Weekend/Friday** (unless emergency)
3. ❌ **During marketing campaigns** (check with marketing team)
4. ❌ **When team unavailable** (ensure 2+ engineers available)

### ALWAYS:

1. ✅ Deploy during low-traffic hours (2 AM - 6 AM IST preferred)
2. ✅ Monitor logs for 30 minutes post-deployment
3. ✅ Keep rollback commands ready in terminal
4. ✅ Have database admin on standby
5. ✅ Test with real payment before announcing

---

## 📊 Monitoring & Alerts

### Real-Time Monitoring

```bash
# Watch container health
watch 'docker ps --filter "name=aarya" --format "{{.Names}}\t{{.Status}}"'

# Watch frontend logs for errors
docker logs -f aarya_frontend | grep -i error

# Watch API response times
docker logs -f aarya_commerce | grep "response_time"

# Watch database connections
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c \
  "SELECT count(*) FROM pg_stat_activity;"
```

### Error Rate Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| HTTP 500 rate | > 1% | > 5% | Investigate/Rollback |
| API latency (p95) | > 2s | > 5s | Scale/Optimize |
| Database errors | > 0 | > 10/hour | Investigate |
| Payment failures | > 2% | > 5% | Check payment gateway |

---

## 📞 Emergency Contacts

### On-Call Team
- **Primary:** [Add contact]
- **Secondary:** [Add contact]
- **Database Admin:** [Add contact]

### External Services
- **Razorpay Support:** support@razorpay.com
- **Hostinger Email:** support@hostinger.com
- **Cloudflare R2:** Via dashboard

---

## 📝 Deployment Checklist

Print this checklist and complete before each deployment:

```
PRE-DEPLOYMENT
[ ] Database backup created and verified
[ ] Git commit hash recorded for rollback
[ ] All containers showing healthy status
[ ] Production site responding (HTTP 200)
[ ] Recent order count recorded
[ ] Team notified of deployment window
[ ] Rollback commands ready in terminal

DEPLOYMENT
[ ] Changes verified (frontend_new/ only)
[ ] No infrastructure changes
[ ] No database migrations
[ ] Build completed successfully
[ ] Container restarted without errors
[ ] Logs show "Ready in Xms"

POST-DEPLOYMENT
[ ] Site responding (HTTP 200)
[ ] Next.js cache working (HIT)
[ ] API responding correctly
[ ] No critical errors in logs
[ ] All containers healthy
[ ] Homepage loads correctly
[ ] Product pages load correctly
[ ] Collection pages load correctly
[ ] Add to cart works
[ ] Checkout flow tested (real payment)
[ ] Order confirmation received
[ ] Admin panel accessible
[ ] Order management works
[ ] Database order count verified

MONITORING (30 minutes post-deployment)
[ ] No increase in error rate
[ ] API latency normal
[ ] No database errors
[ ] Payment success rate normal
[ ] No customer complaints

SIGN-OFF
[ ] All checks passed
[ ] Team notified of successful deployment
[ ] Deployment documented
[ ] Backup retained for 7 days
```

---

## 🔧 Troubleshooting

### Common Issues

**1. Frontend won't start after deployment**
```bash
# Check logs
docker logs aarya_frontend

# Common causes:
# - Environment variable missing
# - API endpoint unreachable
# - Build error

# Quick fix
docker-compose down frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

**2. API returning 500 errors**
```bash
# Check which service is failing
docker ps --filter "name=aarya" --format "{{.Names}}\t{{.Status}}"

# Check service logs
docker logs aarya_commerce --tail 100
docker logs aarya_core --tail 100

# Restart failing service
docker-compose restart <service-name>
```

**3. Database connection errors**
```bash
# Check database is running
docker ps | grep postgres

# Check connection
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "SELECT 1;"

# Restart if needed
docker-compose restart postgres
```

**4. Payment gateway not loading**
```bash
# Check payment service
docker logs aarya_payment --tail 50

# Verify Razorpay keys configured
docker exec aarya_payment env | grep RAZORPAY

# Restart payment service
docker-compose restart payment
```

---

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Production Deployment](https://nextjs.org/docs/deployment)
- [PostgreSQL Backup & Restore](https://www.postgresql.org/docs/backup.html)
- [Razorpay Integration Guide](https://razorpay.com/docs/)

---

**Document Version:** 1.0  
**Maintained By:** Aarya Clothing Development Team  
**Review Schedule:** Monthly or after each major deployment
