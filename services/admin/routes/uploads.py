"""Admin asset uploads — image, video, and presigned URLs.

Thin wrappers over `r2_service` so the admin UI can either:
* Ask the backend for a presigned URL and PUT directly to R2 (fast, no proxy
  bandwidth), or
* Stream the file through this service for cases where the browser cannot do a
  cross-origin PUT.

The `landing/videos/upload` endpoint exists to capture the desktop/mobile
variant alongside the URL so the landing config knows which video to serve.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile

from service.r2_service import r2_service
from shared.auth_middleware import require_admin

router = APIRouter(tags=["Admin Upload"])

_FOLDERS = "^(landing|banners|categories|products|inventory|videos)$"


@router.post("/api/v1/admin/upload/presigned-url")
async def get_presigned_upload_url(
    filename: str,
    folder: str = Query("landing", regex=_FOLDERS),
    content_type: str = Query("image/jpeg"),
    user: dict = Depends(require_admin),
):
    """Generate a presigned R2 URL for a frontend-driven upload.

    Use the returned ``upload_url`` for the PUT and ``final_url`` when saving
    the asset on the matching record.
    """
    return r2_service.generate_presigned_url(
        filename=filename, folder=folder, content_type=content_type
    )


@router.post("/api/v1/admin/upload/image")
async def upload_admin_image(
    file: UploadFile = File(...),
    folder: str = Query("landing", regex=_FOLDERS),
    user: dict = Depends(require_admin),
):
    """Stream an image through the API and return its R2 URL."""
    image_url = await r2_service.upload_image(file, folder=folder)
    return {"image_url": image_url, "folder": folder}


@router.delete("/api/v1/admin/upload/image")
async def delete_admin_image(
    image_url: str,
    user: dict = Depends(require_admin),
):
    deleted = await r2_service.delete_image(image_url)
    return {"deleted": deleted, "image_url": image_url}


@router.post("/api/v1/admin/upload/video")
async def upload_admin_video(
    file: UploadFile = File(...),
    folder: str = Query("videos", regex=_FOLDERS),
    user: dict = Depends(require_admin),
):
    """Upload a video to R2. Caller is responsible for size/type validation
    against MP4/WebM/MOV; r2_service enforces the 50MB cap."""
    video_url = await r2_service.upload_video(file, folder=folder)
    return {"video_url": video_url, "folder": folder}


@router.delete("/api/v1/admin/upload/video")
async def delete_admin_video(
    video_url: str,
    user: dict = Depends(require_admin),
):
    deleted = await r2_service.delete_video(video_url)
    return {"deleted": deleted, "video_url": video_url}


@router.post("/api/v1/admin/landing/videos/upload")
async def upload_landing_video(
    file: UploadFile = File(...),
    device_variant: str = Query("desktop", regex="^(desktop|mobile)$"),
    user: dict = Depends(require_admin),
):
    """Upload a landing intro video and return URL plus device variant.

    The variant lets us serve a 16:9 desktop cut and a 9:16 mobile cut from the
    same site_config keys.
    """
    video_url = await r2_service.upload_video(file, folder="videos")
    return {
        "video_url": video_url,
        "device_variant": device_variant,
        "folder": "videos",
    }
