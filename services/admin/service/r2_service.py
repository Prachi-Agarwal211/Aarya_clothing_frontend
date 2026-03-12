"""Cloudflare R2 storage service for the Admin service.

Handles image uploads for landing pages, banners, and any admin-managed
visual assets. Uses the same R2 bucket as the commerce service.
"""
import logging
import boto3
import uuid
from typing import Optional
from botocore.config import Config
from fastapi import UploadFile, HTTPException, status

from core.config import settings

logger = logging.getLogger(__name__)


ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class R2StorageService:
    """Service for managing file uploads to Cloudflare R2."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        """Lazy-load S3 client configured for Cloudflare R2."""
        if self._client is None:
            if not settings.R2_ACCESS_KEY_ID or not settings.R2_SECRET_ACCESS_KEY:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="R2 storage is not configured. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.",
                )
            self._client = boto3.client(
                "s3",
                endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name=settings.R2_REGION,
                config=Config(signature_version="s3v4"),
            )
        return self._client

    def _generate_key(self, original_filename: str, folder: str = "landing") -> str:
        """Generate a unique object key preserving the file extension."""
        ext = original_filename.rsplit(".", 1)[-1] if "." in original_filename else "jpg"
        uid = uuid.uuid4().hex[:12]
        return f"{folder}/{uid}.{ext}"

    def _public_url(self, key: str) -> str:
        """Build the public URL for an uploaded object."""
        if settings.R2_PUBLIC_URL:
            return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"
        return f"https://{settings.R2_BUCKET_NAME}.{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{key}"

    async def upload_image(
        self,
        file: UploadFile,
        folder: str = "landing",
    ) -> str:
        """
        Upload an image to Cloudflare R2.

        Args:
            file: The uploaded file (must be an image).
            folder: Sub-folder inside the bucket (landing, banners, categories, etc.)

        Returns:
            Public URL of the uploaded image.
        """
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type '{file.content_type}'. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}",
            )

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB.",
            )

        key = self._generate_key(file.filename, folder)

        try:
            self.client.put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key,
                Body=content,
                ContentType=file.content_type,
            )
            return self._public_url(key)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload image to R2: {e}",
            )

    async def delete_image(self, image_url: str) -> bool:
        """
        Delete an image from R2 given its public URL.

        Returns True on success, False on failure (logged only, not raised).
        """
        try:
            if settings.R2_PUBLIC_URL and image_url.startswith(settings.R2_PUBLIC_URL):
                key = image_url.replace(settings.R2_PUBLIC_URL.rstrip("/") + "/", "")
            else:
                key = "/".join(image_url.split("/")[-2:])

            self.client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
            return True
        except Exception as e:
            logger.warning(f"Warning: Failed to delete image {image_url}: {e}")
            return False

    def generate_presigned_url(
        self,
        filename: str,
        folder: str = "landing",
        content_type: str = "image/jpeg",
        expires_in: int = 3600,
    ) -> dict:
        """
        Generate a presigned PUT URL for direct frontend upload.

        Returns:
            Dict with upload_url, final_url, key, and expires_in.
        """
        key = self._generate_key(filename, folder)
        try:
            presigned = self.client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": settings.R2_BUCKET_NAME,
                    "Key": key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
            return {
                "upload_url": presigned,
                "final_url": self._public_url(key),
                "key": key,
                "expires_in": expires_in,
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate presigned URL: {e}",
            )


# Singleton
r2_service = R2StorageService()
