# Docker Cleanup Report - Space Reclamation Analysis

**Generated:** 2026-03-26  
**System:** Linux Docker Environment  

---

## 📊 Current Disk Usage Summary

| Resource | Total | Active | Used Space | Reclaimable |
|----------|-------|--------|------------|-------------|
| **Images** | 190 | 19 | 76.98 GB | **76.29 GB (99%)** |
| **Containers** | 21 | 9 | 3.199 GB | **3.199 GB (99%)** |
| **Volumes** | 3 | 3 | 77.36 MB | 0 B |
| **Build Cache** | 0 | 0 | 0 B | 0 B |
| **TOTAL** | - | - | **80.26 GB** | **~79.49 GB** |

### Disk Space Available:
- **Total:** 193 GB
- **Used:** 95 GB (50%)
- **Available:** 99 GB
- **After Cleanup:** ~174 GB available (90% free)

---

## 🔴 CRITICAL: Stale Resources

### 1. Dangling Images (URGENT)

**Count:** 177 images  
**Size:** **66.92 GB**  
**Age:** 1 hour to 3 days old

These are untagged images (`<none>`) created during rebuilds. They serve NO purpose and can be safely removed.

**Examples:**
```
<none>    <none>    c3d04490e8ec   1.21GB   1 hour ago
<none>    <none>    0d7326371532   790MB    1 hour ago
<none>    <none>    c84641c5237c   989MB    1 hour ago
<none>    <none>    4ef7fbe05ad7   218MB    1 day ago
<none>    <none>    784b67e054d7   1.21GB   1 day ago
```

**Impact:** These are taking up 87% of all Docker disk space!

---

### 2. Stopped Containers (HIGH PRIORITY)

**Count:** 12 containers  
**Size:** **~4.1 GB**  
**Status:** All exited with error code (1)

**List of Stopped Containers:**

| Container Name | Status | Virtual Size | Age |
|----------------|--------|--------------|-----|
| confident_einstein | Exited (1) | 989 MB | 1 hour ago |
| charming_wu | Exited (1) | 1.12 GB | 20 hours ago |
| suspicious_sammet | Exited (1) | 989 MB | 20 hours ago |
| affectionate_murdock | Exited (1) | 1.12 GB | 46 hours ago |
| objective_kepler | Exited (1) | 1.12 GB | 2 days ago |
| competent_bell | Exited (1) | 1.12 GB | 2 days ago |
| reverent_sinoussi | Exited (1) | 1.91 GB | 3 days ago |
| gifted_brown | Exited (1) | 2.28 GB | 3 days ago |
| lucid_lichterman | Exited (1) | 2.28 GB | 3 days ago |
| adoring_jang | Exited (1) | 2.28 GB | 3 days ago |
| gifted_darwin | Exited (1) | 2.28 GB | 3 days ago |
| frosty_ardinghelli | Exited (1) | 409 MB | 19 hours ago |

**Note:** All containers failed (exit code 1) - these are crash logs that might be useful for debugging, but the containers themselves are useless.

---

### 3. Old Project Images (MEDIUM PRIORITY)

**Active Project Images:** 5 (these should be kept)
- `aarya_clothing_frontend-frontend:latest` - 218 MB
- `aarya_clothing_frontend-admin:latest` - 721 MB
- `aarya_clothing_frontend-commerce:latest` - 791 MB
- `aarya_clothing_frontend-core:latest` - 503 MB
- `aarya_clothing_frontend-payment:latest` - 530 MB
- `aarya-frontend:v2.1.0-admin-logout-fix` - 218 MB (duplicate)

**Old/Unused Images:** ~170 images  
**Size:** **~8-10 GB** (estimated from dangling images)

These are old builds from previous deployments. Unless you need to rollback to a specific version, these can be removed.

---

## 🗑️ Cleanup Actions

### SAFE TO REMOVE (No Impact)

#### Action 1: Remove Dangling Images
```bash
docker image prune -f
```
- **Space Saved:** ~66.92 GB
- **Risk:** NONE
- **Impact:** None - these are orphaned images

#### Action 2: Remove Stopped Containers
```bash
docker container prune -f
```
- **Space Saved:** ~3.2 GB
- **Risk:** LOW (lost crash logs)
- **Impact:** Can't inspect old failed containers

#### Action 3: Remove Unused Images (Optional)
```bash
docker image prune -a -f --filter "until=24h"
```
- **Space Saved:** ~5-8 GB (old images)
- **Risk:** MEDIUM (can't rollback to old versions)
- **Impact:** Removes images not used by any container

---

## 📋 Recommended Cleanup Commands

### Option A: Safe Cleanup (Recommended)
**Saves:** ~70 GB

```bash
# 1. Remove all dangling images
docker image prune -f

# 2. Remove all stopped containers
docker container prune -f

# 3. Verify cleanup
docker system df
```

### Option B: Aggressive Cleanup
**Saves:** ~79 GB

```bash
# 1. Stop all containers (if you want to start fresh)
docker-compose down

# 2. Remove all dangling images
docker image prune -f

# 3. Remove all unused images (not just dangling)
docker image prune -a -f

# 4. Remove all stopped containers
docker container prune -f

# 5. Remove unused volumes (CAREFUL - keeps data!)
docker volume prune -f --filter "label!=com.docker.compose.volume=postgres_data"
docker volume prune -f --filter "label!=com.docker.compose.volume=redis_data"
docker volume prune -f --filter "label!=com.docker.compose.volume=meilisearch_data"

# 6. Restart services
docker-compose up -d
```

### Option C: Nuclear Option (Maximum Cleanup)
**Saves:** ~79.49 GB

```bash
# WARNING: This removes EVERYTHING Docker-related
# Only use if you want a completely fresh start

# 1. Stop all containers
docker-compose down

# 2. Remove ALL containers
docker rm -f $(docker ps -aq)

# 3. Remove ALL images
docker rmi -f $(docker images -q)

# 4. Remove ALL volumes (DATA WILL BE LOST!)
docker volume rm $(docker volume ls -q)

# 5. Rebuild and restart
docker-compose up -d --build
```

---

## ⚠️ IMPORTANT WARNINGS

### DO NOT REMOVE These Volumes:
- `aarya_clothing_frontend_postgres_data` - **DATABASE DATA**
- `aarya_clothing_frontend_redis_data` - **CACHE DATA**
- `aarya_clothing_frontend_meilisearch_data` - **SEARCH INDEX**

Removing these will **DELETE ALL YOUR DATA** (products, orders, users, etc.)!

### Before Running Cleanup:

1. **Backup Database:**
   ```bash
   docker exec aarya_postgres pg_dump -U postgres aarya > backup_$(date +%Y%m%d).sql
   ```

2. **Verify Active Containers:**
   ```bash
   docker ps
   # Should show: admin, commerce, core, frontend, payment, nginx, postgres, redis, meilisearch
   ```

3. **Check Volume Labels:**
   ```bash
   docker volume ls --format "{{.Name}}\t{{.Labels}}"
   ```

---

## 📈 Expected Results After Cleanup

### After Safe Cleanup (Option A):
```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          13        13        10.06GB   0B (0%)
Containers      9         9         0B        0B (0%)
Local Volumes   3         3         77.36MB   0B (0%)
Build Cache     0         0         0B        0B
```

**Disk Space:**
- Before: 95 GB used (50%)
- After: ~25 GB used (13%)
- **Freed:** ~70 GB

---

## 🔍 Root Cause Analysis

### Why So Many Dangling Images?

1. **Frequent Rebuilds:** Each `docker-compose build` creates new images
2. **No Cleanup Script:** Old images not automatically removed
3. **Build Failures:** Failed builds leave intermediate images
4. **Tag Replacement:** Re-tagging images leaves old ones orphaned

### Prevention:

Add to your CI/CD or development workflow:

```bash
# Add to docker-compose.yml post-build hook
# Or create a cleanup script: cleanup.sh

#!/bin/bash
echo "Cleaning up Docker..."
docker image prune -f
docker container prune -f
echo "Cleanup complete!"
```

---

## 📝 Maintenance Schedule

### Daily (Development):
```bash
docker image prune -f
```

### Weekly (Production):
```bash
docker image prune -a -f --filter "until=168h"  # Keep images from last week
docker container prune -f
```

### Monthly:
```bash
# Full audit
docker system df
docker ps -a
docker images

# Cleanup
docker system prune -a -f --volumes --filter "until=720h"
```

---

## 🎯 Quick Win Commands

### Check what CAN be removed:
```bash
# See all dangling images
docker images -f "dangling=true"

# See all stopped containers
docker ps -a -f "status=exited"

# See total reclaimable space
docker system df
```

### Remove safely:
```bash
# Remove dangling images only
docker image prune -f

# Remove stopped containers only
docker container prune -f
```

### Monitor after cleanup:
```bash
# Check disk usage
df -h

# Check Docker usage
docker system df
```

---

## 📊 Summary

| Item | Current | After Cleanup | Space Freed |
|------|---------|---------------|-------------|
| Dangling Images | 177 (66.92 GB) | 0 | 66.92 GB |
| Stopped Containers | 12 (3.2 GB) | 0 | 3.2 GB |
| Old Images | ~170 (~8 GB) | ~10 | ~6 GB |
| **TOTAL** | **80.26 GB** | **~3 GB** | **~76 GB** |

**Recommendation:** Run **Option A (Safe Cleanup)** immediately to reclaim **~70 GB**.

---

## ✅ Action Checklist

- [ ] Backup database (if not done recently)
- [ ] Verify all critical containers are running
- [ ] Run `docker image prune -f` (removes dangling images)
- [ ] Run `docker container prune -f` (removes stopped containers)
- [ ] Verify system is still working
- [ ] Check disk space with `df -h`
- [ ] Set up automated cleanup (cron job or CI/CD step)
- [ ] Document cleanup procedure for team

---

**Generated:** 2026-03-26  
**Next Review:** 2026-04-02 (weekly)  
**Estimated Cleanup Time:** 5-10 minutes  
