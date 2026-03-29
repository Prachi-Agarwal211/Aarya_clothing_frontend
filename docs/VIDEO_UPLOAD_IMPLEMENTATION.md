# Video Upload Implementation - Complete Summary

## Overview
This document summarizes all changes made to implement video upload functionality from the admin panel, support separate desktop (16:9) and mobile (9:16) videos, and fix mobile UX issues.

---

## Backend Changes

### 1. `/services/admin/service/r2_service.py`

**Added Constants:**
```python
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

VIDEO_SIGNATURES = {
    "mp4": bytes([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70]),
    "webm": bytes([0x1A, 0x45, 0xDF, 0xA3]),
    "mov": bytes([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70]),
}
```

**Added Methods:**
- `_validate_video_magic_bytes()` - Validates video format using magic bytes
- `upload_video()` - Uploads video files to R2 (50MB limit, format validation)
- `delete_video()` - Deletes video files from R2

---

### 2. `/services/admin/main.py`

**Updated Regex Pattern:**
- Changed folder regex from `^(landing|banners|categories|products|inventory)$` 
- To: `^(landing|banners|categories|products|inventory|videos)$`

**Added Endpoints:**

#### POST `/api/v1/admin/upload/video`
```python
async def upload_admin_video(
    file: UploadFile,
    folder: str = "videos",
    user: dict = Depends(require_admin)
)
```
- Uploads video to R2
- Returns: `{video_url, folder}`

#### DELETE `/api/v1/admin/upload/video`
```python
async def delete_admin_video(
    video_url: str,
    user: dict = Depends(require_admin)
)
```
- Deletes video from R2
- Returns: `{deleted, video_url}`

#### POST `/api/v1/admin/landing/videos/upload`
```python
async def upload_landing_video(
    file: UploadFile,
    device_variant: str = "desktop",  # or "mobile"
    user: dict = Depends(require_admin)
)
```
- Uploads intro video with device variant metadata
- Returns: `{video_url, device_variant, folder}`

---

### 3. `/services/core/main.py`

**Updated GET `/api/v1/site/config`:**

**New Response Format:**
```json
{
  "logo": "...",
  "video": {
    "desktop": "https://r2.url/videos/xyz.mp4",
    "mobile": "https://r2.url/videos/abc.mp4",
    "enabled": true
  },
  "brand_name": "...",
  "noise": "...",
  "r2BaseUrl": "..."
}
```

**Backward Compatibility:**
- Checks for `intro_video_url_desktop` and `intro_video_url_mobile`
- Falls back to legacy `intro_video_url` if new fields don't exist
- Mobile defaults to desktop URL if no mobile variant exists

---

### 4. `/docker/postgres/init.sql`

**Updated Site Config Seed:**
```sql
INSERT INTO site_config (key, value, description) VALUES
    ('intro_video_url_desktop', '...', 'URL of the intro video for desktop (16:9)'),
    ('intro_video_url_mobile', '...', 'URL of the intro video for mobile (9:16)'),
    ('intro_video_enabled', 'true', 'Whether to show the intro video'),
    ...
```

**Migration Script:**
```sql
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM site_config WHERE key = 'intro_video_url') 
       AND NOT EXISTS (SELECT 1 FROM site_config WHERE key = 'intro_video_url_desktop') THEN
        -- Copy old URL to desktop
        INSERT INTO site_config (key, value, description)
        SELECT 'intro_video_url_desktop', value, '...'
        FROM site_config WHERE key = 'intro_video_url';
        
        -- Copy old URL to mobile
        INSERT INTO site_config (key, value, description)
        SELECT 'intro_video_url_mobile', value, '...'
        FROM site_config WHERE key = 'intro_video_url';
        
        -- Remove old key
        DELETE FROM site_config WHERE key = 'intro_video_url';
    END IF;
END $$;
```

---

## Frontend Changes

### 5. `/frontend_new/lib/adminApi.js`

**Added to `uploadApi`:**
```javascript
export const uploadApi = {
  // ... existing methods ...
  
  uploadVideo: (file, folder = 'videos') =>
    adminClient.uploadFile(`/api/v1/admin/upload/video?folder=${folder}`, file),

  deleteVideo: (videoUrl) =>
    adminClient.delete(`/api/v1/admin/upload/video?video_url=${encodeURIComponent(videoUrl)}`),

  uploadLandingVideo: (file, deviceVariant = 'desktop') =>
    adminClient.uploadFile(`/api/v1/admin/landing/videos/upload?device_variant=${deviceVariant}`, file),
};
```

---

### 6. `/frontend_new/app/admin/landing/page.js`

**Updated Imports:**
```javascript
import { landingApi, productsApi, siteConfigApi, uploadApi } from '@/lib/adminApi';
```

**Updated State Management:**
- `handleEditSection()` now initializes `intro_video_url_desktop` and `intro_video_url_mobile`
- `handleSaveSection()` saves both desktop and mobile URLs to site config

**New Handlers:**
```javascript
const handleVideoUpload = async (e, deviceVariant) => {
  // Validates file type (video/*)
  // Validates file size (max 50MB)
  // Uploads via uploadApi.uploadLandingVideo()
  // Updates editForm with video URL
}

const handleDeleteVideo = async (deviceVariant) => {
  // Deletes video via uploadApi.deleteVideo()
  // Clears video URL from editForm
}
```

**Updated UI:**
- Separate upload sections for desktop (16:9) and mobile (9:16) videos
- Video preview for each variant
- Delete button for each video
- Aspect ratio guidance labels
- Drag & drop file upload support
- Upload progress indicator

---

### 7. `/frontend_new/components/landing/IntroVideo.jsx`

**New State:**
```javascript
const [autoplayFailed, setAutoplayFailed] = useState(false);
const [videoLoaded, setVideoLoaded] = useState(false);
```

**Mobile UX Fixes:**

1. **Skip Button Position:**
   - OLD: `bottom-4 right-4 sm:bottom-8 sm:right-8` (bottom-right)
   - NEW: `bottom-6 left-1/2 -translate-x-1/2 sm:bottom-8 sm:right-8 sm:left-auto sm:translate-x-0`
   - Bottom-center on mobile, bottom-right on desktop

2. **Start Video Button (NEW):**
   ```jsx
   {autoplayFailed && (
     <button
       onClick={() => videoRef.current?.play()}
       className="absolute bottom-20 left-1/2 -translate-x-1/2 px-6 py-3 bg-[#B76E79]/90 ..."
     >
       ▶ Start Video
     </button>
   )}
   ```

3. **Better Autoplay Handling:**
   ```javascript
   videoRef.current.play()
     .then(() => setAutoplayFailed(false))
     .catch((err) => {
       logger.warn('Autoplay failed:', err);
       setAutoplayFailed(true);
     });
   ```

4. **Video Loading Handler:**
   ```javascript
   const handleVideoCanPlay = () => {
     setVideoLoaded(true);
   };
   ```

5. **Footer Visibility:**
   - Footer is already conditionally rendered based on `showLanding` state
   - IntroVideo returns `null` when ended, ensuring footer is hidden during playback

---

### 8. `/frontend_new/lib/siteConfigContext.js`

**Updated `useIntroVideo()` Hook:**
```javascript
export function useIntroVideo() {
  const { video } = useSiteConfig();
  
  // New format: video is { desktop, mobile, enabled }
  // Backward compatibility: video.intro (legacy string format)
  const intro = video?.intro;
  
  // Normalize: backend may send a plain string (legacy) or { desktop, mobile }
  if (typeof intro === 'string') {
    // Legacy format - use same URL for both
    return { desktop: intro, mobile: intro };
  }
  
  // New format from backend
  return {
    desktop: video?.desktop || intro?.desktop || null,
    mobile: video?.mobile || intro?.mobile || null,
  };
}
```

---

## Testing Checklist

### Backend
- [ ] Video upload endpoint accepts MP4, WebM, MOV files
- [ ] Video upload rejects files > 50MB
- [ ] Video upload validates magic bytes
- [ ] Video delete endpoint works correctly
- [ ] Site config endpoint returns `{desktop, mobile}` video object
- [ ] Backward compatibility works with legacy `intro_video_url`

### Frontend Admin
- [ ] Desktop video upload works (16:9 aspect ratio guidance)
- [ ] Mobile video upload works (9:16 aspect ratio guidance)
- [ ] Video preview shows after upload
- [ ] Delete video works for both variants
- [ ] Save updates site config with both URLs
- [ ] Upload progress indicator shows during upload

### Frontend User Experience
- [ ] Desktop users see desktop video (16:9)
- [ ] Mobile users see mobile video (9:16)
- [ ] Video fills screen on mobile (no black bars)
- [ ] Skip button at bottom-center on mobile
- [ ] Skip button at bottom-right on desktop
- [ ] "Start Video" button appears if autoplay fails
- [ ] Mute/unmute works properly
- [ ] Sound hint appears after 3 seconds
- [ ] Footer is hidden during video playback
- [ ] Landing content fades in after video ends

---

## API Response Examples

### Site Config Response (New Format)
```json
{
  "logo": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png",
  "video": {
    "desktop": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/videos/desktop-intro.mp4",
    "mobile": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/videos/mobile-intro.mp4",
    "enabled": true
  },
  "brand_name": "Aarya Clothing",
  "noise": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/noise.png",
  "r2BaseUrl": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev"
}
```

### Video Upload Response
```json
{
  "video_url": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/videos/abc123.mp4",
  "device_variant": "desktop",
  "folder": "videos"
}
```

---

## Deployment Steps

1. **Database Migration:**
   ```bash
   # The migration is automatic in init.sql
   # Existing intro_video_url will be copied to desktop/mobile variants
   ```

2. **Backend Deployment:**
   ```bash
   # Restart admin service
   docker-compose restart admin
   
   # Restart core service
   docker-compose restart core
   ```

3. **Frontend Deployment:**
   ```bash
   # Rebuild frontend
   cd frontend_new
   npm run build
   
   # Restart frontend
   docker-compose restart frontend
   ```

4. **Verification:**
   - Navigate to `/admin/landing`
   - Select "Intro Video" section
   - Upload desktop video (16:9)
   - Upload mobile video (9:16)
   - Save configuration
   - Visit homepage and verify video plays correctly on both devices

---

## File Changes Summary

| File | Changes | Purpose |
|------|---------|---------|
| `services/admin/service/r2_service.py` | Added video upload methods | R2 video storage |
| `services/admin/main.py` | Added 3 video endpoints | Admin API |
| `services/core/main.py` | Updated site/config endpoint | Public API |
| `docker/postgres/init.sql` | Added desktop/mobile columns | Database schema |
| `frontend_new/lib/adminApi.js` | Added video upload methods | API client |
| `frontend_new/app/admin/landing/page.js` | Complete video UI overhaul | Admin dashboard |
| `frontend_new/components/landing/IntroVideo.jsx` | Mobile UX fixes | User experience |
| `frontend_new/lib/siteConfigContext.js` | Updated useIntroVideo hook | Context provider |

---

## Performance Considerations

1. **Video Optimization:**
   - Max file size: 50MB (enforced by backend)
   - Recommended: Desktop < 10MB, Mobile < 5MB
   - Use H.264 codec for maximum compatibility

2. **Aspect Ratios:**
   - Desktop: 16:9 (e.g., 1920x1080)
   - Mobile: 9:16 (e.g., 1080x1920)

3. **Caching:**
   - Site config cached in Redis (1 hour TTL)
   - Browser caching via R2 CDN

4. **Loading:**
   - Branded preloader shows during video load
   - `onCanPlay` event tracks video readiness
   - Graceful fallback if video fails to load

---

## Security Features

1. **File Validation:**
   - Content-Type validation
   - Magic bytes verification
   - File size limits

2. **Authentication:**
   - All upload endpoints require admin authentication
   - CSRF protection enabled

3. **Access Control:**
   - Video deletion requires admin privileges
   - Presigned URLs expire after 1 hour

---

## Troubleshooting

### Video doesn't upload
- Check file size (must be < 50MB)
- Verify file format (MP4, WebM, or MOV)
- Check R2 credentials in environment variables

### Video doesn't play on mobile
- Ensure mobile video has 9:16 aspect ratio
- Check browser console for CORS errors
- Verify video codec compatibility

### Autoplay fails
- This is expected behavior in modern browsers
- "Start Video" button should appear
- User interaction required to enable sound

### Skip button in wrong position
- Check viewport width (mobile vs desktop breakpoint)
- Verify CSS classes applied correctly
- Clear browser cache if needed

---

## Contact

For questions or issues related to this implementation, refer to the project documentation or contact the development team.
