"""Product schemas for commerce service."""
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from schemas.product_image import ProductImageResponse
from schemas.inventory import InventoryResponse
from schemas.collection import CollectionResponse
from schemas.category import CategoryResponse  # backward-compat alias


class ProductBase(BaseModel):
    """Base product schema."""
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    price: Decimal
    mrp: Optional[Decimal] = None
    category_id: Optional[int] = None   # collection_id alias
    collection_id: Optional[int] = None  # preferred name
    brand: Optional[str] = None
    image_url: Optional[str] = None
    is_featured: bool = False
    is_new_arrival: bool = False
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


class VariantCreate(BaseModel):
    """Schema for creating a product variant (inventory row) at product creation time."""
    size: str
    color: str
    quantity: int = 0
    sku: Optional[str] = None
    variant_price: Optional[Decimal] = None


class ProductCreate(ProductBase):
    """Schema for creating a product."""
    sku: Optional[str] = None
    inventory_count: int = 0
    initial_stock: Optional[int] = 0
    variants: Optional[List[VariantCreate]] = None  # If provided, creates these instead of Standard/Standard


class ProductUpdate(BaseModel):
    """Schema for updating a product."""
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    category_id: Optional[int] = None
    collection_id: Optional[int] = None
    brand: Optional[str] = None
    image_url: Optional[str] = None
    inventory_count: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_new_arrival: Optional[bool] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


class ProductResponse(BaseModel):
    """Schema for product list response with full R2 image URL."""
    id: int
    name: str
    slug: Optional[str] = None
    short_description: Optional[str] = None
    price: Decimal
    mrp: Optional[Decimal] = None
    category_id: Optional[int] = None
    collection_id: Optional[int] = None
    brand: Optional[str] = None
    image_url: Optional[str] = None  # Full R2 URL (constructed by API)
    is_active: bool
    is_featured: bool
    is_new_arrival: bool
    total_stock: int = 0
    inventory_count: int = 0
    is_on_sale: bool = False
    discount_percentage: int = 0
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None
    is_taxable: Optional[bool] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProductDetailResponse(ProductResponse):
    """Detailed product response with images, inventory and collection."""
    description: Optional[str] = None
    sku: Optional[str] = None
    images: List[ProductImageResponse] = []
    inventory: List[InventoryResponse] = []
    collection: Optional[CollectionResponse] = None
    category: Optional[CollectionResponse] = None  # backward-compat alias
    primary_image: Optional[str] = None  # Full R2 URL
    collection_name: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    
    class Config:
        from_attributes = True


# ==================== Bulk Operation Schemas ====================

class BulkPriceUpdate(BaseModel):
    """Bulk price update for multiple products."""
    product_ids: List[int]
    price: Optional[Decimal] = None          # Set absolute price
    mrp: Optional[Decimal] = None            # Set absolute MRP
    price_adjustment: Optional[Decimal] = None   # Add/subtract fixed amount
    price_percentage: Optional[float] = None     # Adjust by percentage (+10 = +10%, -5 = -5%)
    mrp_adjustment: Optional[Decimal] = None     # Add/subtract fixed amount to MRP
    mrp_percentage: Optional[float] = None       # Adjust MRP by percentage
    dry_run: bool = False



class BulkStatusUpdate(BaseModel):
    """Bulk activate/deactivate/feature products."""
    product_ids: List[int]
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_new_arrival: Optional[bool] = None
    dry_run: bool = False



class BulkCollectionAssign(BaseModel):
    """Bulk assign products to a collection."""
    product_ids: List[int]
    collection_id: int
    dry_run: bool = False



class BulkInventoryUpdate(BaseModel):
    """Bulk inventory quantity update."""
    updates: List[dict]  # [{"sku": "KRT-001-S", "quantity": 50}, ...]
    dry_run: bool = False



class BulkDeleteProducts(BaseModel):
    """Bulk delete products."""
    product_ids: List[int]
