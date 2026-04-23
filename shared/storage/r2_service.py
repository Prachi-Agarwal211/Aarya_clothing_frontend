"""Shared Cloudflare R2 storage service for Aarya Clothing.

This module provides a centralized implementation for uploading, managing,
and deleting files from Cloudflare R2 storage.

Usage:
    from shared.storage.r2_service import R2StorageService
    
    r2 = R2StorageService()
    url = await r2.upload_image(file, folder="products")
"""

import logging
import boto3
import uuid
from typing import Optional, BinaryIO
from botocore.config import Config
from fastapi import UploadFile, HTTPException, status

from shared.base_config import BaseSettings

logger = logging.getLogger(__name__)

# Configuration constants
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Magic bytes for image file type verification
IMAGE_SIGNATURES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG': 'image/png',
    b'RIFF': 'image/webp',   # WebP: RIFF....WEBP
    b'GIF8': 'image/gif',
}


class R2StorageService:
    """Service for managing file uploads to Cloudflare R2."""

    def __init__(self):
        """Initialize R2 client."""
        self._client = None

    @property
    def client(self):
        """Lazy-load S3 client for R2."""
        if self._client is None:
            settings = BaseSettings()
            
            if not settings.R2_ACCESS_KEY_ID or not settings.R2_SECRET_ACCESS_KEY:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="R2 storage is not configured"
                )

            self._client = boto3.client(
                's3',
                endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name=settings.R2_REGION,
                config=Config(signature_version='s3v4')
            )
        return self._client

    def _generate_unique_filename(self, original_filename: str, folder: str = "products") -> str:
        """Generate a unique, sanitized filename."""
        ext = original_filename.rsplit('.', 1)[-1].lower() if '.' in original_filename else 'jpg'
        # Only allow safe extensions
        safe_extensions = {'jpg', 'jpeg', 'png', 'webp', 'gif'}
        if ext not in safe_extensions:
            ext = 'jpg'
        unique_id = uuid.uuid4().hex[:12]
        return f"{folder}/{unique_id}.{ext}"

    def _validate_magic_bytes(self, content: bytes, claimed_type: str) -> bool:
        """Verify file content matches its claimed MIME type via magic bytes."""
        for signature, mime_type in IMAGE_SIGNATURES.items():
            if content[:len(signature)] == signature:
                return True
        return False

    def _public_url(self, key: str) -> str:
        """Build the public URL for an uploaded object."""
        settings = BaseSettings()
        if settings.R2_PUBLIC_URL:
            return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"
        return f"https://{settings.R2_BUCKET_NAME}.{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{key}"

    async def upload_image(
        self,
        file: UploadFile,
        folder: str = "products"
    ) -> str:
        """
        Upload an image to R2 storage.

        Args:
            file: The uploaded file
            folder: Subfolder in bucket (products, categories, landing, etc.)

        Returns:
            Public URL of the uploaded image

        Raises:
            HTTPException: If file type is invalid or file is too large
        """
        # Validate file type
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type '{file.content_type}'. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}"
            )

        # Read and validate file content
        content = await file.read()
        
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large (max {MAX_FILE_SIZE // (1024*1024)}MB)"
            )

        # Validate magic bytes
        if not self._validate_magic_bytes(content, file.content_type):
            logger.warning(f"Magic bytes validation failed for {file.filename}")

        # Generate unique filename
        key = self._generate_unique_filename(file.filename, folder)

        # Upload to R2
        try:
            settings = BaseSettings()
            self.client.put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key,
                Body=content,
                ContentType=file.content_type
            )

            public_url = self._public_url(key)
            logger.info(f"Uploaded image to R2: {public_url}")
            return public_url

        except Exception as e:
            logger.error(f"R2 upload failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload image: {str(e)}"
            )

    async def delete_image(self, image_url: str) -> bool:
        """
        Delete an image from R2 storage.

        Args:
            image_url: Public URL of the image to delete

        Returns:
            True if deleted successfully

        Raises:
            HTTPException: If deletion fails
        """
        try:
            settings = BaseSettings()
            
            # Extract key from URL
            if settings.R2_PUBLIC_URL and image_url.startswith(settings.R2_PUBLIC_URL):
                key = image_url.replace(settings.R2_PUBLIC_URL.rstrip("/") + "/", "")
            else:
                # Try to extract from standard R2 URL
                key = image_url.split("/")[-1]
                # Assume default folder if not specified
                key = f"products/{key}"

            # Delete from R2
            self.client.delete_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key
            )

            logger.info(f"Deleted image from R2: {key}")
            return True

        except Exception as e:
            logger.error(f"R2 deletion failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete image: {str(e)}"
            )

    async def upload_multiple_images(
        self,
        files: list[UploadFile],
        folder: str = "products"
    ) -> list[str]:
        """
        Upload multiple images to R2 storage.

        Args:
            files: List of uploaded files
            folder: Subfolder in bucket

        Returns:
            List of public URLs

        Raises:
            HTTPException: If any upload fails
        """
        urls = []
        for file in files:
            try:
                url = await self.upload_image(file, folder)
                urls.append(url)
            except HTTPException as e:
                logger.error(f"Failed to upload {file.filename}: {e.detail}")
                raise

        return urls

    async def create_presigned_url(
        self,
        key: str,
        expiration: int = 3600
    ) -> str:
        """
        Create a presigned URL for temporary access to a private object.

        Args:
            key: Object key in R2
            expiration: URL expiration time in seconds (default: 1 hour)

        Returns:
            Presigned URL

        Raises:
            HTTPException: If URL generation fails
        """
        try:
            settings = BaseSettings()
            
            url = self.client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.R2_BUCKET_NAME,
                    'Key': key
                },
                ExpiresIn=expiration
            )

            logger.info(f"Created presigned URL for {key}")
            return url

        except Exception as e:
            logger.error(f"Presigned URL generation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate presigned URL: {str(e)}"
            )


# Singleton instance for easy import
_r2_instance = None

def get_r2_service() -> R2StorageService:
    """Get or create R2 service singleton."""
    global _r2_instance
    if _r2_instance is None:
        _r2_instance = R2StorageService()
    return _r2_instance
