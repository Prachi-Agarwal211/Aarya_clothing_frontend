# Session Timeout Analysis & Fix

**Date:** April 13, 2026  
**Issue:** Customer getting logged out after ~10 minutes  
**Status:** ⚠️ Partial Fix Applied + Recommendations

---

## 🔍 ROOT CAUSE IDENTIFIED

### **Critical Bug Fixed:**
The refresh token cookie was set to **30 minutes** (same as access token) when `remember_me=False`.

**Before Fix:**
```python
refresh_max_age = (
    settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60  # 24 hours
    if remember_me
    else settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # ❌ 30 minutes!
)
```

**After Fix:**
```python
refresh_max_age = settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60  # ✅ ALWAYS 24 hours
```

---

## 📊 Current Token Configuration

| Component | Value | Purpose |
|-----------|-------|---------|
| **Access Token JWT** | 30 minutes | Short-lived API token |
| **Refresh Token JWT** | 24 hours (1440 min) | Extends session |
| **Refresh Token Cookie** | 24 hours (FIXED) | HttpOnly cookie for refresh |
| **Access Token Cookie** | 30 minutes | HttpOnly cookie for API |
| **Redis Session** | 24 hours | Server-side session tracking |
| **Proactive Refresh** | Every 45-50 min | Client-side token refresh |

---

## 🚨 WHY 10 MINUTES (Not 30)?

The fix above explains the 30-minute timeout, but **10 minutes** suggests additional issues:

### **Possible Causes:**

#### **1. Docker Container Restarts** ⚠️ (Most Likely)
- Container crashes/restarts every ~10 minutes
- Redis restarts clear sessions
- Check: `docker ps -a` (look for recent restarts)
- Check: `docker logs core --tail 200 | grep -i "error\|crash\|restart"`

#### **2. Nginx Configuration Issues**
- Nginx reloading frequently
- SSL session timeout misconfiguration
- Check: `docker logs nginx --tail 100`

#### **3. Browser Cookie Policies**
- Strict third-party cookie blocking
- HTTPS/HTTP mismatch with `Secure` flag
- Check browser DevTools → Application → Cookies

#### **4. SECRET_KEY Rotation**
- If SECRET_KEY changes during runtime, ALL tokens become invalid
- Check if any auto-deployment or config reload is happening
- Check: `docker logs core | grep -i "secret\|token.*invalid\|JWT"`

#### **5. Redis Memory Eviction**
- Redis running out of memory
- Evicting session keys early
- Check: `docker exec redis redis-cli INFO memory`
- Check: `docker exec redis redis-cli CONFIG GET maxmemory-policy`

---

## ✅ FIXES APPLIED

### **Fix #1: Refresh Token Cookie Duration** (APPLIED)
**File:** `services/core/main.py`  
**Change:** Refresh token cookie now ALWAYS 24 hours, regardless of `remember_me`

---

## 🎯 RECOMMENDED ADDITIONAL FIXES

### **Fix #2: Improve Error Logging on Token Refresh**

**Problem:** When refresh fails, we don't know WHY (network error? invalid token? server down?)

**File:** `frontend_new/lib/authContext.js` (line 115-134)

**Add detailed logging:**
```javascript
} catch (err) {
  if (err.status === 401) {
    logger.error('Proactive refresh returned 401 — session dead', {
      error: err.message,
      path: window.location.pathname,
      timestamp: new Date().toISOString()
    });
    // ... existing logout code
  } else {
    logger.warn('Proactive refresh failed (network/server error)', {
      error: err.message,
      status: err.status,
      path: window.location.pathname,
      timestamp: new Date().toISOString()
    });
  }
}
```

---

### **Fix #3: Add Cookie Debugging in Development**

**Problem:** Hard to see if cookies are being set correctly

**Add to `services/core/main.py` after cookie setting:**
```python
# DEBUG: Log cookie settings (remove in production)
logger.info(f"Auth cookies set for user {user_id}, remember_me={remember_me}, "
            f"access_max_age={access_max_age}, refresh_max_age={refresh_max_age}, "
            f"domain={cookie_domain}, secure={settings.COOKIE_SECURE}")
```

---

### **Fix #4: Extend Proactive Refresh Interval**

**Current:** Every 45-50 minutes  
**Recommended:** Every 20-25 minutes (more conservative)

**Why:** Access token is 30 minutes. If proactive refresh fails once, you still have time for another attempt before access token expires.

**File:** `frontend_new/lib/authContext.js` (line 108)

```javascript
// Change from 45 minutes to 20 minutes
const REFRESH_INTERVAL_MS = 20 * 60 * 1000 + Math.floor(Math.random() * 5 * 60 * 1000);
// 20-25 minutes instead of 45-50 minutes
```

---

### **Fix #5: Add Health Check Endpoint**

Create an endpoint that checks if auth is working:

```python
@app.get("/api/v1/auth/health")
async def auth_health(request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    
    return {
        "status": "ok",
        "has_access_token": bool(access_token),
        "has_refresh_token": bool(refresh_token),
        "timestamp": datetime.utcnow().isoformat()
    }
```

---

## 🔧 DIAGNOSTIC COMMANDS

### **Check Container Health:**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### **Check Core Service Logs:**
```bash
docker logs core --tail 200 | grep -i "auth\|token\|login\|logout\|error"
```

### **Check Redis Sessions:**
```bash
docker exec redis redis-cli KEYS "user_sessions:*"
docker exec redis redis-cli INFO keyspace
```

### **Check Browser Cookies:**
1. Open DevTools (F12)
2. Application tab → Cookies → `https://aaryaclothing.in`
3. Look for:
   - `access_token` (should exist when logged in)
   - `refresh_token` (should exist when logged in)
   - Check Expiry dates
   - Check Domain (should be `.aaryaclothing.in` in production)

---

## 📋 TESTING CHECKLIST

After deploying the fix:

- [ ] **Login without "Remember Me"** → Should stay logged in for 24 hours
- [ ] **Login with "Remember Me"** → Should stay logged in for 24 hours
- [ ] **Wait 30 minutes** → Should auto-refresh access token seamlessly
- [ ] **Wait 1 hour** → Should still be logged in
- [ ] **Wait 23 hours** → Should still be logged in
- [ ] **Wait 25 hours** → Should be logged out (expected, refresh token expired)
- [ ] **Check browser console** → No 401 errors during normal use
- [ ] **Check network tab** → Refresh endpoint called every 45 minutes (or 20 min if Fix #4 applied)

---

## 🎯 SUMMARY

### **What Was Wrong:**
1. ✅ **Refresh token cookie expired in 30 minutes** (not 24 hours) when `remember_me=False`
2. ⚠️ **Something else causing 10-minute timeout** (likely infrastructure: Docker/Redis/Nginx)

### **What We Fixed:**
1. ✅ Refresh token cookie now ALWAYS 24 hours

### **What You Need To Do:**
1. 🔍 **Investigate infrastructure** - check Docker container stability
2. 📊 **Monitor logs** - look for patterns in 401 errors
3. 🧪 **Test thoroughly** - use checklist above
4. 🎯 **Consider Fix #4** - shorten proactive refresh interval for reliability

---

## 📞 NEED MORE HELP?

If the 10-minute issue persists after deploying this fix, run these diagnostics:

```bash
# 1. Check if containers are restarting
watch -n 5 'docker ps --format "table {{.Names}}\t{{.Status}}"'

# 2. Monitor auth-related logs
docker logs -f core 2>&1 | grep -i "auth\|token\|login"

# 3. Check Redis memory and eviction
docker exec redis redis-cli INFO memory
docker exec redis redis-cli INFO stats

# 4. Check browser cookies in real-time
# Open DevTools → Application → Cookies → Watch for deletions
```

The 10-minute timeout is likely an **infrastructure issue** (Docker, Redis, or Nginx) rather than an auth configuration problem.
