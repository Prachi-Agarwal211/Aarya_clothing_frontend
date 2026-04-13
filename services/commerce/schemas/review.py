"""Review schemas for commerce service."""
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


MAX_REVIEW_IMAGES = 5


class ReviewBase(BaseModel):
    """Base review schema."""
    rating: int
    title: Optional[str] = None
    comment: Optional[str] = None
    image_urls: Optional[List[str]] = []

    @field_validator('rating')
    @classmethod
    def validate_rating(cls, v):
        """Validate rating is between 1-5."""
        if v < 1 or v > 5:
            raise ValueError('Rating must be between 1 and 5')
        return v

    @field_validator('image_urls')
    @classmethod
    def validate_image_urls(cls, v):
        """Validate image URLs: max 5, must be HTTP(S) URLs, must be from allowed R2 domain."""
        if not v:
            return []

        if len(v) > MAX_REVIEW_IMAGES:
            raise ValueError(f'Maximum {MAX_REVIEW_IMAGES} images allowed per review')

        validated_urls = []
        for url in v:
            if not url.startswith(('http://', 'https://')):
                raise ValueError(f'Invalid image URL (must start with http:// or https://): {url}')
            # Reject data: URIs and javascript: schemes
            if url.lower().startswith(('data:', 'javascript:', 'file:')):
                raise ValueError(f'Invalid image URL scheme: {url}')
            validated_urls.append(url)

        return validated_urls


class ReviewCreate(ReviewBase):
    """Schema for creating a review."""
    product_id: int
    order_id: Optional[int] = None


class ReviewResponse(ReviewBase):
    """Schema for review response."""
    id: int
    product_id: int
    user_id: int
    order_id: Optional[int]
    is_verified_purchase: bool
    is_approved: bool
    helpful_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
