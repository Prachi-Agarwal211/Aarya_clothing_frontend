# Video Upload System

**Last Updated:** April 8, 2026  
**Status:** Production Ready

---

## Overview

The video upload system allows admins to upload separate desktop (16:9) and mobile (9:16) intro videos from the admin panel. Videos are stored in R2 and served with a triple-layer fallback chain to ensure users always see a video.

---

## Architecture

### Backend Components

**1. R2 Service** (`services/admin/service/r2_service.py`)
- Video upload with magic bytes validation
- Supports MP4, WebM, MOV (max 50MB)
- Delete functionality

**2. Admin API** (`services/admin/main.py`)
- `POST /api/v1/admin/upload/video` - Generic video upload
- `DELETE /api/v1/admin/upload/video` - Delete video by URL
- `POST /api/v1/admin/landing/videos/upload` - Upload with device variant (desktop/mobile)

**3. Core Service** (`services/core/main.py`)
- `GET /api/v1/site/config` returns video object with desktop/mobile variants
- Backend-level fallback chain (mobile → desktop → legacy → default)

**4. Database** (`docker/postgres/init.sql`)
- `intro_video_url_desktop` - Desktop video URL (16:9)
- `intro_video_url_mobile` - Mobile video URL (9:16)
- Automatic migration from legacy `intro_video_url`

### Frontend Components

**1. Admin Upload UI** (`frontend_new/app/admin/landing/page.js`)
- Separate upload sections for desktop and mobile
- Drag & drop support
- Video preview before saving
- Delete functionality

**2. Site Config Context** (`frontend_new/lib/siteConfigContext.js`)
- `useIntroVideo()` hook with fallback logic
- Handles both legacy and new API formats

**3. IntroVideo Component** (`frontend_new/components/landing/IntroVideo.jsx`)
- Device-aware video selection
- Autoplay failure detection with manual start button
- Skip button (bottom-center on mobile, bottom-right on desktop)
- Mute/unmute controls with sound hints

---

## Fallback Chain (CRITICAL SAFETY)

### Triple-Layer Fallback

```
USER VISITS SITE (MOBILE)
         │
         ▼
┌────────────────────────────────────────┐
│ Step 1: intro_video_url_mobile         │
│        - Exists? → USE IT ✅           │
│        - NOT? → Continue fallback      │
└─────────────┬──────────────────────────┘
              │
              ▼
┌────────────────────────────────────────┐
│ Step 2: intro_video_url_desktop        │
│        - Exists? → USE IT ✅           │
│        - NOT? → Continue fallback      │
└─────────────┬──────────────────────────┘
              │
              ▼
┌────────────────────────────────────────┐
│ Step 3: legacy intro_video_url         │
│        - Exists? → USE IT ✅           │
│        - NOT? → Continue fallback      │
└─────────────┬──────────────────────────┘
              │
              ▼
┌────────────────────────────────────────┐
│ Step 4: Hardcoded default video        │
│        - ALWAYS exists ✅              │
└────────────────────────────────────────┘

RESULT: ✅ Mobile user ALWAYS gets a video (NEVER empty)
```

This fallback exists at 3 levels:
1. **Backend** - API response construction
2. **Context Hook** - `useIntroVideo()` normalization
3. **Component** - Final video URL selection in `IntroVideo.jsx`

---

## Performance Optimization

### Code-Level Optimizations
- ✅ No artificial preloader delays
- ✅ `preload="metadata"` instead of `preload="auto"` (saves bandwidth)
- ✅ Reactive preloader (shows only when buffering)
- ✅ Immediate video download on component mount

### Video File Guidelines

| Metric | Recommendation |
|--------|---------------|
| **Desktop size** | 800KB - 1.5MB |
| **Mobile size** | 500KB - 1MB |
| **Desktop resolution** | 1920x1080 (16:9) |
| **Mobile resolution** | 720x1280 (9:16) |
| **Max duration** | 10-15 seconds |
| **Codec** | H.264 (MP4) |
| **Audio** | Remove (video is muted anyway) |

### Compression Command (ffmpeg)

```bash
# Desktop (16:9)
ffmpeg -i original.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease" \
  -c:v libx264 -preset medium -crf 23 -b:v 1500k \
  -c:a aac -b:a 64k -movflags +faststart \
  -t 15 desktop_optimized.mp4

# Mobile (9:16)
ffmpeg -i original.mp4 \
  -vf "scale=720:1280:force_original_aspect_ratio=decrease" \
  -c:v libx264 -preset medium -crf 24 -b:v 1000k \
  -c:a aac -b:a 48k -movflags +faststart \
  -t 15 mobile_optimized.mp4
```

---

## Admin Workflow

1. Navigate to `/admin/landing`
2. Select "Intro Video" section
3. Upload desktop video (16:9 ratio recommended)
4. Upload mobile video (9:16 ratio recommended)
5. Toggle "Show Intro Video" to enable/disable
6. Click "Save Changes"

**Minimum requirement:** At least ONE video must be uploaded (desktop recommended). Mobile will fall back to desktop if no mobile variant exists.

---

## API Reference

### Upload Video
```http
POST /api/v1/admin/upload/video?folder=videos
Content-Type: multipart/form-data
Authorization: Bearer <admin_token>

file: <video_file>
```

**Response:**
```json
{
  "video_url": "https://pub-xxxx.r2.dev/videos/uuid.mp4",
  "folder": "videos"
}
```

### Upload Landing Video with Device Variant
```http
POST /api/v1/admin/landing/videos/upload?device_variant=desktop
Content-Type: multipart/form-data

file: <video_file>
```

**Response:**
```json
{
  "video_url": "https://pub-xxxx.r2.dev/videos/uuid.mp4",
  "device_variant": "desktop",
  "folder": "videos"
}
```

### Get Site Config (Public)
```http
GET /api/v1/site/config
```

**Response:**
```json
{
  "logo": "https://.../logo.png",
  "video": {
    "intro": {
      "desktop": "https://.../desktop.mp4",
      "mobile": "https://.../mobile.mp4"
    },
    "enabled": true
  },
  "brand_name": "Aarya Clothing",
  "r2BaseUrl": "https://pub-xxxx.r2.dev"
}
```

---

## Security

- ✅ File type validation (MP4, WebM, MOV only)
- ✅ Magic bytes verification (prevents fake extensions)
- ✅ File size limit (50MB max)
- ✅ Admin authentication required for all upload endpoints
- ✅ CSRF protection enabled

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Video upload fails | Check file type (MP4/WebM/MOV) and size (<50MB) |
| Video doesn't play | Check browser console for CORS errors, verify codec is H.264 |
| Autoplay fails | Expected behavior - "Start Video" button appears |
| Mobile shows desktop video | Expected fallback - upload dedicated mobile video |
| Different videos on devices | Working as intended - device-specific videos |

---

## File Locations

| File | Purpose |
|------|---------|
| `services/admin/service/r2_service.py` | R2 video storage logic |
| `services/admin/main.py` | Admin upload endpoints |
| `services/core/main.py` | Public API with fallback chain |
| `docker/postgres/init.sql` | Database schema (desktop/mobile columns) |
| `frontend_new/lib/adminApi.js` | API client upload methods |
| `frontend_new/app/admin/landing/page.js` | Admin upload UI |
| `frontend_new/components/landing/IntroVideo.jsx` | Video player component |
| `frontend_new/lib/siteConfigContext.js` | Context hook with fallback |
