"""Collection schemas — canonical naming for category/collection management."""
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
import re


class CollectionBase(BaseModel):
    """Base collection schema."""
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None  # R2 relative path; full URL returned by API
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
            return re.sub(r'[^a-z0-9-]', '', name.lower().replace(' ', '-'))
        return v


class CollectionCreate(CollectionBase):
    """Schema for creating a collection."""
    pass


class CollectionUpdate(BaseModel):
    """Schema for partially updating a collection."""
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class CollectionResponse(BaseModel):
    """Schema for collection API responses (full R2 image URL built by route layer)."""
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    display_order: int
    is_active: bool
    is_featured: bool
    created_at: datetime
    updated_at: datetime
    product_count: Optional[int] = 0

    class Config:
        from_attributes = True


class CollectionWithProducts(CollectionResponse):
    """Collection response including flat product count."""
    product_count: int = 0

    class Config:
        from_attributes = True


class CollectionList(BaseModel):
    """Paginated list of collections."""
    collections: List[CollectionWithProducts]


# ── Bulk operation schemas ──────────────────────────────────────────────────

class BulkCollectionStatusUpdate(BaseModel):
    """Bulk activate/deactivate collections."""
    ids: List[int]
    is_active: bool


class BulkCollectionReorder(BaseModel):
    """Bulk reorder collections. items: [{"id": 1, "display_order": 0}, ...]"""
    items: List[dict]


# ── Backward-compat aliases ─────────────────────────────────────────────────
CategoryBase = CollectionBase
CategoryCreate = CollectionCreate
CategoryUpdate = CollectionUpdate
CategoryResponse = CollectionResponse
CategoryWithChildren = CollectionWithProducts
CategoryTree = CollectionList
