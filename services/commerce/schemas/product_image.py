"""Product image schemas for commerce service."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProductImageBase(BaseModel):
    """Base product image schema."""
    image_url: str
    alt_text: Optional[str] = None
    display_order: int = 0
    is_primary: bool = False


class ProductImageCreate(ProductImageBase):
    """Schema for creating a product image."""
    pass


class ProductImageResponse(BaseModel):
    """Schema for product image response."""
    id: int
    product_id: int
    image_url: str
    alt_text: Optional[str] = None
    display_order: int
    is_primary: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
