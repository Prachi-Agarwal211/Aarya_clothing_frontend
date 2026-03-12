"""Cloudflare R2 storage service for image uploads."""
import logging
import boto3
import uuid
from typing import Optional, BinaryIO
from botocore.config import Config
from fastapi import UploadFile, HTTPException, status

from core.config import settings

logger = logging.getLogger(__name__)


ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
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
    
    async def upload_image(
        self, 
        file: UploadFile, 
        folder: str = "products"
    ) -> str:
        """
        Upload an image to R2 storage.
        
        Args:
            file: The uploaded file
            folder: Subfolder in bucket (products, categories, etc.)
            
        Returns:
            The public URL of the uploaded image
        """
        # Validate MIME type
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type '{file.content_type}'. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}"
            )
        
        # Read file content
        content = await file.read()

        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB."
            )

        # Validate magic bytes (actual file content)
        if not self._validate_magic_bytes(content, file.content_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match an allowed image type."
            )
        
        # Generate unique filename
        key = self._generate_unique_filename(file.filename, folder)
        
        try:
            # Upload to R2
            self.client.put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key,
                Body=content,
                ContentType=file.content_type
            )
            
            # Return public URL
            if settings.R2_PUBLIC_URL:
                return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"
            else:
                return f"https://{settings.R2_BUCKET_NAME}.{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{key}"
                
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload image: {str(e)}"
            )
    
    async def delete_image(self, image_url: str) -> bool:
        """
        Delete an image from R2 storage.
        
        Args:
            image_url: The full URL of the image to delete
            
        Returns:
            True if deleted successfully
        """
        try:
            # Extract the R2 object key from whatever form the URL is in
            if image_url.startswith('http://') or image_url.startswith('https://'):
                # Full URL — strip the base to get the key
                if settings.R2_PUBLIC_URL and image_url.startswith(settings.R2_PUBLIC_URL):
                    key = image_url.replace(settings.R2_PUBLIC_URL.rstrip('/') + '/', '')
                else:
                    # Fallback: take everything after the domain
                    from urllib.parse import urlparse
                    key = urlparse(image_url).path.lstrip('/')
            else:
                # Already a relative path (e.g. "products/abc123.jpg")
                key = image_url.lstrip('/')
            
            self.client.delete_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key
            )
            return True
            
        except Exception as e:
            logger.warning(f"Warning: Failed to delete image {image_url}: {str(e)}")
            return False
    
    def generate_presigned_url(
        self, 
        filename: str, 
        folder: str = "products",
        expires_in: int = 3600
    ) -> dict:
        """
        Generate a presigned URL for direct client-side upload.
        
        Args:
            filename: Original filename
            folder: Subfolder in bucket
            expires_in: URL expiration time in seconds
            
        Returns:
            Dict with upload_url and final_url
        """
        key = self._generate_unique_filename(filename, folder)
        
        try:
            presigned_url = self.client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': settings.R2_BUCKET_NAME,
                    'Key': key
                },
                ExpiresIn=expires_in
            )
            
            if settings.R2_PUBLIC_URL:
                final_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"
            else:
                final_url = f"https://{settings.R2_BUCKET_NAME}.{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{key}"
            
            return {
                "upload_url": presigned_url,
                "final_url": final_url,
                "key": key
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate presigned URL: {str(e)}"
            )


# Singleton instance
r2_service = R2StorageService()
