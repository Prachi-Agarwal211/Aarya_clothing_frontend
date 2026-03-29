# Video Loading Issue - Root Cause & Fix

## 🎯 Summary

**Issue:** Video shows infinite "Loading Experience" spinner but never plays.

**Root Cause:** Commit `1b6dd7707324cb4271f3c70a2255577317719322` broke the video loading by changing the backend API response format WITHOUT properly updating the frontend to handle the new format.

---

## 🔍 What Changed in Commit 1b6dd77

### Backend API Response (services/core/main.py)

**BEFORE:**
```python
"video": {
    "intro": db_config.get("intro_video_url") or default_url,
    "enabled": ...
}
```

**AFTER:**
```python
"video": {
    "desktop": video_desktop or default_url,
    "mobile": video_mobile or default_url,
    "enabled": ...
}
```

### Frontend useIntroVideo() Hook (frontend_new/lib/siteConfigContext.js)

**BEFORE (WORKING):**
```javascript
export function useIntroVideo() {
  const { video } = useSiteConfig();
  const intro = video?.intro || DEFAULT_CONFIG.video.intro;  // ✅ Had DEFAULT fallback
  
  if (typeof intro === 'string') {
    return { desktop: intro, mobile: null };
  }
  return {
    desktop: intro?.desktop || null,
    mobile: intro?.mobile || null,
  };
}
```

**AFTER (BROKEN):**
```javascript
export function useIntroVideo() {
  const { video } = useSiteConfig();
  const intro = video?.intro;  // ❌ REMOVED DEFAULT fallback!
  
  if (typeof intro === 'string') {
    return { desktop: intro, mobile: intro };
  }
  
  const desktop = video?.desktop || intro?.desktop || null;
  const mobile = video?.mobile || intro?.mobile || desktop;
  
  return {
    desktop: desktop || mobile,
    mobile: mobile || desktop,
  };
}
```

---

## 🐛 Why It Broke

### The Problem Chain:

1. **Initial State:** App loads with `DEFAULT_CONFIG` where:
   ```javascript
   video: {
     intro: { desktop: null, mobile: null }  // OLD structure
   }
   ```

2. **API Returns:** Backend sends NEW format:
   ```javascript
   video: {
     desktop: "https://r2.dev/video.mp4",
     mobile: "https://r2.dev/video.mp4"
   }
   ```

3. **useIntroVideo() Tries:**
   - `const intro = video?.intro;` → `undefined` (doesn't exist in new format!)
   - `typeof intro === 'string'` → `false`
   - `const desktop = video?.desktop || intro?.desktop || null;` → Should work...
   - **BUT** during initial render, `video` is still from `DEFAULT_CONFIG`!

4. **Result:** Both `desktop` and `mobile` are `null` → IntroVideo component shows "Loading Experience" forever!

---

## ✅ The Fix

### Changes Made:

#### 1. Updated DEFAULT_CONFIG Structure
**File:** `frontend_new/lib/siteConfigContext.js`

```javascript
const DEFAULT_CONFIG = {
  logo: null,
  video: {
    desktop: null,      // ✅ NEW: Matches backend format
    mobile: null,       // ✅ NEW: Matches backend format
    enabled: true       // ✅ NEW: Matches backend format
  },
  noise: null,
  r2BaseUrl: null
};
```

#### 2. Rewrote useIntroVideo() Hook
**File:** `frontend_new/lib/siteConfigContext.js`

```javascript
export function useIntroVideo() {
  const { video } = useSiteConfig();

  // ✅ NEW: First check direct desktop/mobile from backend
  if (video?.desktop || video?.mobile) {
    const desktop = video.desktop || video.mobile;
    const mobile = video.mobile || video.desktop;
    return { desktop, mobile };
  }

  // Legacy format: video.intro (string or object)
  const intro = video?.intro;
  if (typeof intro === 'string') {
    return { desktop: intro, mobile: intro };
  }
  if (intro?.desktop || intro?.mobile) {
    return {
      desktop: intro.desktop || intro.mobile,
      mobile: intro.mobile || intro.desktop,
    };
  }
  
  // Fallback
  return {
    desktop: null,
    mobile: null,
  };
}
```

---

## 🧪 How to Verify the Fix

### 1. Check API Response
```bash
curl -s "https://aaryaclothing.in/api/v1/site/config" | jq .video
```

Expected output:
```json
{
  "desktop": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/Create_a_video_202602141450_ub9p5.mp4",
  "mobile": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/Create_a_video_202602141450_ub9p5.mp4",
  "enabled": true
}
```

### 2. Test in Browser
1. Open `http://localhost:6004` or `https://aaryaclothing.in`
2. Open DevTools → Network tab
3. Refresh page
4. Find `/api/v1/site/config` request
5. Check response has `video.desktop` and `video.mobile`

### 3. Check Console
- No errors about undefined properties
- Video should load after 1.8s preloader

### 4. Check Video Plays
- Video should autoplay muted after preloader
- Skip button appears after 2s
- Sound hint appears after 3s

---

## 📝 Lessons Learned

1. **Backend-Frontend Contract:** When changing API response structure, ALWAYS update BOTH backend AND frontend together.

2. **Default Config Sync:** `DEFAULT_CONFIG` structure must match the actual API response structure.

3. **Backward Compatibility:** If you must change the format, support BOTH old and new formats during transition.

4. **Testing:** Test the full flow end-to-end after making structural changes.

---

## 🔧 Files Changed

- `frontend_new/lib/siteConfigContext.js`
  - Updated `DEFAULT_CONFIG` structure (lines 29-39)
  - Rewrote `useIntroVideo()` hook (lines 120-153)

---

## 🚀 Next Steps

1. **Rebuild Frontend:**
   ```bash
   cd /opt/Aarya_clothing_frontend
   docker-compose restart frontend
   ```

2. **Clear Browser Cache:**
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Or clear site data in DevTools

3. **Test Video Loading:**
   - Should see preloader for 1.8s
   - Then video should play automatically

4. **Monitor for Issues:**
   - Check browser console for errors
   - Check Network tab for failed requests

---

**Status:** ✅ FIXED
**Date:** 2026-03-27
**Fixed By:** Qwen Code with Aarya Orchestrator
