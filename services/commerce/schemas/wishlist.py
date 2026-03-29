"""Wishlist schemas for commerce service."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from schemas.product import ProductResponse


class WishlistItemBase(BaseModel):
    """Base wishlist item schema."""
    product_id: int


class WishlistItemCreate(WishlistItemBase):
    """Schema for adding item to wishlist."""
    pass


class WishlistItemResponse(BaseModel):
    """Schema for wishlist item response."""
    id: int
    user_id: int
    product_id: int
    added_at: datetime
    product: Optional[ProductResponse] = None
    
    class Config:
        from_attributes = True


class WishlistResponse(BaseModel):
    """Schema for user's complete wishlist."""
    user_id: int
    items: list[WishlistItemResponse]
    total_items: int
