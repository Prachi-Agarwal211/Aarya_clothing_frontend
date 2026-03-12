"""Review schemas for commerce service."""
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class ReviewBase(BaseModel):
    """Base review schema."""
    rating: int
    title: Optional[str] = None
    comment: Optional[str] = None
    
    @field_validator('rating')
    @classmethod
    def validate_rating(cls, v):
        """Validate rating is between 1-5."""
        if v < 1 or v > 5:
            raise ValueError('Rating must be between 1 and 5')
        return v


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
