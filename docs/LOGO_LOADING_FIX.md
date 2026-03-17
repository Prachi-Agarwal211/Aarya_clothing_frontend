# Logo Loading Fix - Production Issue

**Date:** 2026-03-17  
**Issue:** Logo not loading on production (aaryaclothing.in)  
**Status:** ✅ FIXED

---

## ROOT CAUSE

The logo wasn't loading due to a **configuration mismatch**:

1. **Backend returned R2 URL**: `https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png`
2. **logo.png was NOT in R2**: Only existed in `/frontend_new/public/logo.png` (local)
3. **imageLoader routed through Cloudflare CDN**: CDN tried to fetch from R2 → **404 NOT FOUND**
4. **Database missing logo_url**: The `site_config` table had no `logo_url` entry

### Why imageLoader Didn't Catch It

The original imageLoader.ts checked `isR2Url()` **BEFORE** `isLocalStaticAsset()`:

```typescript
// BEFORE (BROKEN):
if (isR2Url(src)) {
  // Routes through Cloudflare CDN → 404
  return `/cdn-cgi/image/${params.join(",")}/${normalizedSrc}`;
}

if (isLocalStaticAsset(src)) {
  // Never reached for R2 URLs!
  return src;
}
```

Even though `/logo.png` was listed as a local static asset, the R2 URL pattern matched first.

---

## COMPLETE FIX

### Fix 1: imageLoader.ts - Check Local Assets FIRST ✅

**File:** `frontend_new/imageLoader.ts`

Changed the order of checks to prioritize local static assets:

```typescript
// AFTER (FIXED):
// CRITICAL FIX: Check local static assets FIRST before R2 URLs
if (isLocalStaticAsset(src)) {
  // Return as-is, Next.js will optimize via /_next/image
  return src;
}

// R2 URLs: Use Cloudflare Images CDN for optimization
if (isR2Url(src)) {
  return `/cdn-cgi/image/${params.join(",")}/${normalizedSrc}`;
}
```

**Impact:** Now `logo.png`, `noise.png`, and other local assets are ALWAYS served from `/public`, even if backend sends an R2 URL.

---

### Fix 2: Database - Add logo_url Entry

**File:** `docker/postgres/init.sql` (for new deployments)  
**File:** `scripts/migration_add_logo_url.sql` (for existing databases)

Added `logo_url` to the `site_config` table:

```sql
INSERT INTO site_config (key, value, description) 
VALUES (
    'logo_url', 
    'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png', 
    'URL of the brand logo'
)
ON CONFLICT (key) DO UPDATE 
SET 
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;
```

---

### Fix 3: Upload logo.png to R2 (Production Only)

**Script:** `scripts/upload_logo_to_r2.py`

For production consistency, upload logo.png to R2:

```bash
# Set R2 environment variables
export R2_ACCOUNT_ID=your_account_id
export R2_ACCESS_KEY_ID=your_access_key
export R2_SECRET_ACCESS_KEY=your_secret_key
export R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Run upload script
python scripts/upload_logo_to_r2.py
```

---

## DEPLOYMENT STEPS

### For Production (aaryaclothing.in)

1. **Upload logo.png to R2:**
   ```bash
   python scripts/upload_logo_to_r2.py
   ```

2. **Run database migration:**
   ```bash
   # Connect to production database
   psql -h <host> -U postgres -d aarya_clothing
   
   # Run migration
   \i scripts/migration_add_logo_url.sql
   
   # Verify
   SELECT key, value FROM site_config WHERE key = 'logo_url';
   ```

3. **Deploy frontend changes:**
   ```bash
   # imageLoader.ts change is in the codebase
   # Rebuild and redeploy frontend
   cd frontend_new
   npm run build
   docker-compose -f docker-compose.yml up -d --build frontend
   ```

4. **Restart backend services:**
   ```bash
   docker-compose -f docker-compose.yml restart core admin commerce
   ```

---

## VERIFICATION STEPS

### 1. Check R2 Upload

Open in browser:
```
https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png
```

**Expected:** Logo image displays (295KB PNG)

---

### 2. Check Database

```sql
SELECT key, value FROM site_config WHERE key = 'logo_url';
```

**Expected:**
```
key       | value
----------|--------------------------------------------------
logo_url  | https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png
```

---

### 3. Check API Response

```bash
curl https://aaryaclothing.in/api/v1/site/config | jq '.logo'
```

**Expected:**
```json
"https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png"
```

---

### 4. Check Browser Console

1. Open https://aaryaclothing.in
2. Open DevTools → Console
3. Look for errors

**Expected:** NO 404 errors for logo.png

---

### 5. Check Network Tab

1. Open DevTools → Network
2. Filter by "logo"
3. Refresh page

**Expected:**
- Status: 200 OK
- Source: Either R2 URL or `/_next/image` (both are valid)
- Size: ~295KB
- No 404 errors

---

### 6. Visual Verification

1. Open https://aaryaclothing.in
2. Check header logo in top-left corner
3. Check logo on auth pages (login, register, etc.)

**Expected:** Logo displays correctly on all pages

---

## FILES CHANGED

| File | Change | Purpose |
|------|--------|---------|
| `frontend_new/imageLoader.ts` | Reordered checks | Local assets checked BEFORE R2 URLs |
| `docker/postgres/init.sql` | Added logo_url | Seed data for new deployments |
| `scripts/migration_add_logo_url.sql` | NEW | Migration for existing databases |
| `scripts/upload_logo_to_r2.py` | NEW | Upload logo to R2 |

---

## ARCHITECTURE DECISION

**Why check local assets FIRST?**

This provides **defense in depth**:

1. **Primary**: Logo served from `/public` (fast, no external dependency)
2. **Fallback**: If R2 is down, logo still loads
3. **Consistency**: `noise.png`, `placeholder-image.jpg` also served locally

**Why upload to R2 anyway?**

1. **Architecture consistency**: All dynamic images from R2
2. **CDN optimization**: Cloudflare Images can optimize logo
3. **Future-proof**: If we need to update logo, single source of truth

---

## PREVENTION

To prevent similar issues in the future:

1. **Always upload new static assets to R2** if backend returns R2 URLs
2. **Update database seed data** when adding new site_config keys
3. **Test image loading** in staging before production deployment
4. **Add monitoring** for 404 errors on image assets

---

## ROLLBACK PLAN

If issues occur after deployment:

1. **Revert imageLoader.ts:**
   ```bash
   git checkout HEAD -- frontend_new/imageLoader.ts
   ```

2. **Remove logo_url from database:**
   ```sql
   DELETE FROM site_config WHERE key = 'logo_url';
   ```

3. **Restart services:**
   ```bash
   docker-compose restart frontend core admin
   ```

---

## CONTACT

For questions or issues, contact the development team.
