# 🚨 ROLLBACK PROCEDURE - Quick Reference

**⚠️ EMERGENCY USE ONLY - For Production Issues**

**Production URL:** https://aaryaclothing.in  
**Last Known Good Commit:** `43f0891` (as of April 1, 2026)

---

## 🆘 Immediate Rollback (< 1 minute)

### Scenario 1: Site Down or Critical Errors

```bash
# STEP 1: Stop the problematic frontend container
docker stop aarya_frontend

# STEP 2: Revert git to last known good commit
cd /opt/Aarya_clothing_frontend
git reset --hard 43f0891

# STEP 3: Rebuild frontend with known good code
docker-compose build frontend

# STEP 4: Start frontend
docker-compose up -d frontend

# STEP 5: Verify site is back up
curl -I https://aaryaclothing.in
# Expected: HTTP/2 200
```

### Scenario 2: Checkout/Payment Broken

```bash
# IMMEDIATE ACTION - Restore previous version
cd /opt/Aarya_clothing_frontend
git revert HEAD
docker-compose build frontend
docker-compose up -d frontend

# Verify payment gateway loads
curl -s "https://aaryaclothing.in/api/v1/payments/razorpay" | head -5
```

### Scenario 3: Database Issues

```bash
# STEP 1: Find most recent backup
ls -lt /opt/backups/*.sql | head -1
# Note the filename: /opt/backups/aarya_backup_YYYYMMDD_HHMMSS.sql

# STEP 2: Stop application to prevent new writes
docker-compose stop frontend admin

# STEP 3: Restore database
docker exec -i aarya_postgres psql -U postgres aarya_clothing < \
  /opt/backups/aarya_backup_YYYYMMDD_HHMMSS.sql

# STEP 4: Restart services
docker-compose start frontend admin

# STEP 5: Verify database accessible
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "SELECT COUNT(*) FROM orders;"
```

---

## 📋 Rollback Decision Matrix

| Issue | Response Time | Action |
|-------|---------------|--------|
| **Site returns 500 errors** | IMMEDIATE | Rollback immediately |
| **Checkout not working** | < 5 minutes | Rollback if fix > 10 min |
| **Payment failures > 5%** | IMMEDIATE | Rollback + contact Razorpay |
| **Database connection errors** | IMMEDIATE | Rollback + restore backup |
| **Admin panel broken** | < 30 minutes | Fix forward (customers OK) |
| **UI glitches** | < 1 hour | Fix forward if minor |
| **Performance degradation** | < 1 hour | Investigate, rollback if critical |
| **Search not working** | < 2 hours | Fix forward (non-critical) |

---

## 🔍 Diagnostic Commands

### Check What's Broken

```bash
# 1. Check container status
docker ps --filter "name=aarya" --format "table {{.Names}}\t{{.Status}}"

# 2. Check frontend logs for errors
docker logs --tail 100 aarya_frontend | grep -i error

# 3. Check API service logs
docker logs --tail 100 aarya_commerce | grep -i error
docker logs --tail 100 aarya_core | grep -i error

# 4. Check database logs
docker logs --tail 50 aarya_postgres | grep -i error

# 5. Check nginx logs
docker logs --tail 100 aarya_nginx | grep -i error

# 6. Test API endpoint
curl -s "https://aaryaclothing.in/api/v1/products?limit=1" | jq

# 7. Check database connectivity
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "SELECT 1;"
```

### Verify Rollback Success

```bash
# 1. Check git commit
cd /opt/Aarya_clothing_frontend
git log -1 --oneline
# Should show: 43f0891

# 2. Check site responding
curl -I https://aaryaclothing.in
# Expected: HTTP/2 200

# 3. Check Next.js cache
curl -sI https://aaryaclothing.in | grep x-nextjs-cache
# Expected: HIT (after first request)

# 4. Check all containers healthy
docker ps --filter "name=aarya" --format "table {{.Names}}\t{{.Status}}"
# Expected: All "Up" with "(healthy)"

# 5. Test critical flow
curl -s "https://aaryaclothing.in/api/v1/products?limit=1" | jq '.total'
# Expected: Number (current: 9)
```

---

## 📞 Emergency Contacts

### Internal Team
| Role | Contact | Escalation |
|------|---------|------------|
| Primary Engineer | [Add number] | First call |
| Secondary Engineer | [Add number] | If primary unavailable |
| Database Admin | [Add number] | For database issues |
| DevOps Lead | [Add number] | For infrastructure issues |

### External Services
| Service | Contact | Purpose |
|---------|---------|---------|
| Razorpay | support@razorpay.com | Payment issues |
| Hostinger | support@hostinger.com | Email/SMTP issues |
| Cloudflare | Via dashboard | R2 storage issues |
| VPS Provider | [Add support] | Server issues |

---

## 🛠️ Rollback Scripts

### Full Rollback Script (Save as `rollback.sh`)

```bash
#!/bin/bash
set -e

echo "🚨 EMERGENCY ROLLBACK INITIATED"
echo "================================"

# Configuration
LAST_GOOD_COMMIT="43f0891"
BACKUP_DIR="/opt/backups"
PROJECT_DIR="/opt/Aarya_clothing_frontend"

# Step 1: Find latest backup
echo "📦 Finding latest database backup..."
LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.sql 2>/dev/null | head -1)
if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No database backup found!"
    exit 1
fi
echo "✅ Found backup: $LATEST_BACKUP"

# Step 2: Stop services
echo "🛑 Stopping services..."
cd $PROJECT_DIR
docker-compose stop frontend admin

# Step 3: Revert git
echo "🔄 Reverting git to $LAST_GOOD_COMMIT..."
git reset --hard $LAST_GOOD_COMMIT

# Step 4: Restore database (optional - uncomment if needed)
# echo "💾 Restoring database from backup..."
# docker exec -i aarya_postgres psql -U postgres aarya_clothing < $LATEST_BACKUP

# Step 5: Rebuild frontend
echo "🔨 Rebuilding frontend..."
docker-compose build frontend

# Step 6: Start services
echo "🚀 Starting services..."
docker-compose up -d frontend admin

# Step 7: Verify
echo "✅ Verifying rollback..."
sleep 10
curl -I https://aaryaclothing.in | head -1

echo "================================"
echo "✅ ROLLBACK COMPLETE"
echo "Commit: $(git log -1 --oneline)"
echo "Time: $(date)"
```

**Usage:**
```bash
chmod +x rollback.sh
./rollback.sh
```

---

## 📊 Post-Rollback Actions

### Immediate (First 15 Minutes)

1. **Verify Site Functionality**
   - [ ] Homepage loads
   - [ ] Product pages load
   - [ ] Checkout works (test transaction)
   - [ ] Admin panel accessible

2. **Check Logs**
   - [ ] No new errors in frontend logs
   - [ ] No new errors in API logs
   - [ ] No database errors

3. **Notify Stakeholders**
   - [ ] Team notified of rollback
   - [ ] Customer support informed
   - [ ] Management updated

### Short-Term (First 2 Hours)

1. **Monitor Metrics**
   - [ ] Error rate back to normal
   - [ ] Payment success rate normal
   - [ ] No customer complaints

2. **Root Cause Analysis**
   - [ ] Document what broke
   - [ ] Identify why it wasn't caught
   - [ ] Plan prevention measures

3. **Communication**
   - [ ] Incident report drafted
   - [ ] Timeline documented
   - [ ] Lessons learned recorded

---

## 🎯 Prevention Measures

### Before Next Deployment

1. **Enhanced Testing**
   - [ ] Add automated checkout test
   - [ ] Add payment gateway test
   - [ ] Add API contract tests
   - [ ] Add visual regression tests

2. **Improved Monitoring**
   - [ ] Set up error rate alerts
   - [ ] Set up payment failure alerts
   - [ ] Set up response time alerts
   - [ ] Set up uptime monitoring

3. **Process Improvements**
   - [ ] Require staging environment
   - [ ] Require peer review
   - [ ] Require automated tests pass
   - [ ] Require performance tests pass

---

## 📝 Rollback Log Template

```
ROLLBACK INCIDENT REPORT
========================

Date/Time: _______________
Initiated By: _______________
Reason: _______________

Timeline:
- Issue detected: _______________
- Decision to rollback: _______________
- Rollback started: _______________
- Rollback completed: _______________
- Services restored: _______________

Impact:
- Duration of outage: _______________
- Affected features: _______________
- Customer complaints: _______________
- Lost transactions: _______________

Root Cause:
_______________
_______________

Prevention:
_______________
_______________

Sign-off:
Engineer: _______________
Manager: _______________
```

---

**Document Version:** 1.0  
**Last Updated:** April 1, 2026  
**Review Schedule:** After each incident  
**Next Drill:** Schedule quarterly rollback drill
