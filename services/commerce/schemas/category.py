"""Collection/Category schemas for commerce service.

Categories and Collections are the same thing in this system.
All schemas use 'Category' naming for backward compatibility.
"""
from pydantic import BaseModel, field_validator, computed_field
from typing import Optional, List
from datetime import datetime
import re


class CategoryBase(BaseModel):
    """Base collection/category schema."""
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None  # R2 relative path stored; full URL returned by API
    display_order: int = 0
    is_active: bool = True
    is_featured: bool = False
    
    @field_validator('slug', mode='before')
    @classmethod
    def generate_slug(cls, v, info):
        """Auto-generate slug from name if not provided."""
        if v:
            return v
        name = info.data.get('name', '')
        if name:
            slug = re.sub(r'[^a-z0-9-]', '', name.lower().replace(' ', '-'))
            return slug
        return v


class CategoryCreate(CategoryBase):
    """Schema for creating a collection."""
    pass


class CategoryUpdate(BaseModel):
    """Schema for updating a collection."""
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class CategoryResponse(BaseModel):
    """Schema for collection response with full R2 image URL."""
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None  # Full R2 URL (constructed by API layer)
    display_order: int
    is_active: bool
    is_featured: bool
    created_at: datetime
    updated_at: datetime
    product_count: Optional[int] = 0
    
    class Config:
        from_attributes = True


class CategoryWithChildren(CategoryResponse):
    """Collection response (no hierarchy — flat collections)."""
    product_count: int = 0
    
    class Config:
        from_attributes = True


class CategoryTree(BaseModel):
    """Full collections list."""
    categories: List[CategoryWithChildren]


# ==================== Bulk Operation Schemas ====================

class BulkCollectionStatusUpdate(BaseModel):
    """Bulk activate/deactivate collections."""
    ids: List[int]
    is_active: bool


class BulkCollectionReorder(BaseModel):
    """Bulk reorder collections."""
    items: List[dict]  # [{"id": 1, "display_order": 1}, ...]


# Aliases so code can use either name
CollectionCreate = CategoryCreate
CollectionUpdate = CategoryUpdate
CollectionResponse = CategoryResponse
