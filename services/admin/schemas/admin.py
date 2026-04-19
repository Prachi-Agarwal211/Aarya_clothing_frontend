"""Schemas for admin dashboard, analytics, orders, customers, and inventory."""

from datetime import datetime
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any, Dict
from enum import Enum


# ==================== Dashboard with Period Filter ====================


class InventoryAlert(BaseModel):
    low_stock: int = 0
    out_of_stock: int = 0


class DashboardOverview(BaseModel):
    """Dashboard overview with period filter support."""

    period: str = "daily"  # daily, weekly, monthly
    total_revenue: float = 0
    total_orders: int = 0
    total_customers: int = 0
    total_products: int = 0
    pending_orders: int = 0
    period_revenue: float = 0  # Revenue in selected period
    period_orders: int = 0  # Orders in selected period
    period_new_customers: int = 0  # New customers in period
    inventory_alerts: InventoryAlert = InventoryAlert()
    recent_orders: List[Dict[str, Any]] = []


class DashboardPeriodRequest(BaseModel):
    """Request dashboard data for specific period."""

    period: str = Field("daily", description="Period: daily, weekly, monthly")


# ==================== Analytics ====================


class RevenueData(BaseModel):
    period: str
    revenue: float
    orders: int


class RevenueAnalytics(BaseModel):
    total_revenue: float
    period_data: List[RevenueData]
    growth_percentage: Optional[float] = None


class CustomerAnalytics(BaseModel):
    total_customers: int
    new_customers_today: int
    new_customers_this_week: int
    new_customers_this_month: int
    returning_customers: int


class TopProduct(BaseModel):
    product_id: int
    product_name: str
    total_sold: int
    total_revenue: float


class TopProductsAnalytics(BaseModel):
    top_products: List[TopProduct]
    period: str


# ==================== Orders ====================


class OrderStatusUpdate(BaseModel):
    status: str
    pod_number: Optional[str] = (
        None  # POD = Proof of Delivery / tracking number. Required when status=shipped.
    )
    tracking_number: Optional[str] = None  # Alias for pod_number (backward compat)
    courier: Optional[str] = None
    estimated_delivery: Optional[str] = None
    notes: Optional[str] = None

    def get_pod(self) -> Optional[str]:
        """Return pod_number, falling back to tracking_number for backward compat."""
        return self.pod_number or self.tracking_number


class BulkOrderUpdate(BaseModel):
    order_ids: List[int]
    status: str  # Must be one of: confirmed, shipped, delivered, cancelled
    pod_number: Optional[str] = None
    courier_name: Optional[str] = None
    notes: Optional[str] = None


class OrderResponse(BaseModel):
    id: int
    user_id: int
    subtotal: float = 0
    shipping_cost: float = 0
    total_amount: float
    status: str
    shipping_address: Optional[str] = None
    transaction_id: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[Dict[str, Any]] = []
    customer: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


# ==================== Inventory ====================


class AddStockRequest(BaseModel):
    product_id: int
    sku: str
    quantity: int = Field(gt=0)
    cost_price: Optional[float] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None


class AdjustStockRequest(BaseModel):
    inventory_id: int
    adjustment: int  # Negative = removal, Positive = addition
    reason: str  # damaged_items, return, correction, transfer
    notes: Optional[str] = None


class InventoryAdjustRequest(BaseModel):
    sku: str
    adjustment: int
    reason: str = "adjustment"
    notes: Optional[str] = None


class BulkInventoryUpdate(BaseModel):
    updates: List[Dict[str, Any]]


class VariantCreate(BaseModel):
    sku: str
    size: Optional[str] = None
    color: Optional[str] = None
    color_hex: Optional[str] = None
    quantity: int = 0
    low_stock_threshold: Optional[int] = 5
    image_url: Optional[str] = None
    is_active: Optional[bool] = True
    # `price` is accepted for back-compat with older clients but ignored —
    # the cleaned product schema no longer has per-variant pricing.
    price: Optional[float] = None
    barcode: Optional[str] = None


class VariantUpdate(BaseModel):
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    color_hex: Optional[str] = None
    quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    price: Optional[float] = None
    barcode: Optional[str] = None


class InventoryMovementResponse(BaseModel):
    id: int
    inventory_id: int
    product_id: int
    adjustment: int
    reason: str
    notes: Optional[str] = None
    supplier: Optional[str] = None
    performed_by: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== Staff ====================


class StaffDashboard(BaseModel):
    inventory_alerts: InventoryAlert
    pending_orders: int
    today_tasks: Dict[str, int]
    quick_actions: List[str]


class OrderProcessRequest(BaseModel):
    status: str = "processing"
    items: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None


class OrderShipRequest(BaseModel):
    tracking_number: str
    courier: str
    estimated_delivery: Optional[str] = None
    notes: Optional[str] = None


class ReservationRelease(BaseModel):
    order_id: int
    items: List[Dict[str, Any]]
    reason: str


class TaskComplete(BaseModel):
    notes: Optional[str] = None


# ==================== Users ====================


class UserListItem(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    created_at: Optional[datetime] = None
    order_count: int = 0
    total_spent: float = 0

    class Config:
        from_attributes = True


class UserStatusUpdate(BaseModel):
    is_active: bool


class BulkUserStatusUpdate(BaseModel):
    user_ids: List[int]
    is_active: bool


# ==================== Chat ====================


class ChatRoomCreate(BaseModel):
    customer_id: int
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    subject: Optional[str] = None
    priority: str = "medium"
    order_id: Optional[int] = None


class ChatMessageCreate(BaseModel):
    message: str
    sender_type: str = "staff"


class ChatRoomResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    assigned_to: Optional[int] = None
    subject: Optional[str] = None
    status: str
    priority: str
    order_id: Optional[int] = None
    created_at: Optional[datetime] = None
    last_message: Optional[str] = None

    class Config:
        from_attributes = True


class ChatMessageResponse(BaseModel):
    id: int
    room_id: int
    sender_id: Optional[int] = None
    sender_type: str
    message: str
    is_read: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== Landing Config ====================


class LandingConfigUpdate(BaseModel):
    config: Dict[str, Any]
    is_active: Optional[bool] = None


class LandingConfigResponse(BaseModel):
    id: int
    section: str
    config: Dict[str, Any]
    is_active: bool
    updated_by: Optional[int] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LandingImageCreate(BaseModel):
    section: str
    image_url: str
    title: Optional[str] = None
    subtitle: Optional[str] = None
    link_url: Optional[str] = None
    display_order: int = 0
    device_variant: Optional[str] = None


class LandingImageResponse(BaseModel):
    id: int
    section: str
    image_url: str
    title: Optional[str] = None
    subtitle: Optional[str] = None
    link_url: Optional[str] = None
    display_order: int
    device_variant: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LandingProductCreate(BaseModel):
    section: str
    product_id: int
    display_order: int = 0
    is_active: bool = True


class LandingProductUpdate(BaseModel):
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


# ==================== Product Catalog (Admin) - Simplified ====================


class ProductCreate(BaseModel):
    """Simplified product creation - name, price, collection only."""

    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255, description="Optional slug — auto-generated from name when omitted")
    description: Optional[str] = None  # Single description field
    base_price: float = Field(..., gt=0, description="Selling price")
    mrp: Optional[float] = Field(None, ge=0, description="MRP (optional)")
    collection_id: int = Field(
        ..., description="Required - collection to which product belongs"
    )
    # `category_id` retained for old clients during the rename window.
    category_id: Optional[int] = None
    brand: Optional[str] = None
    is_active: bool = True
    is_featured: bool = False
    is_new_arrival: bool = False

    @model_validator(mode="after")
    def mrp_gte_base_price(self):
        if self.mrp is not None and self.base_price and self.mrp < self.base_price:
            raise ValueError("MRP must be greater than or equal to selling price")
        return self


class ProductVariantCreate(BaseModel):
    """Variant creation for a product - size/color/stock."""

    size: str = Field(..., min_length=1, max_length=20)  # XS, S, M, L, XL, etc.
    color: str = Field(..., min_length=1, max_length=50)  # Color name e.g. "Red"
    color_hex: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")  # Hex color
    quantity: int = Field(0, ge=0, description="Stock quantity")
    low_stock_threshold: int = Field(5, ge=0, description="Low stock alert threshold")
    image_url: Optional[str] = None  # Per-variant (color) image URL


class ProductVariantUpdate(BaseModel):
    """Update variant stock/information."""

    size: Optional[str] = None
    color: Optional[str] = None
    color_hex: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=0)
    low_stock_threshold: Optional[int] = Field(None, ge=0)
    image_url: Optional[str] = None


class ProductImageCreate(BaseModel):
    """Product image upload."""

    image_url: str
    is_primary: bool = False
    alt_text: Optional[str] = None


class ProductUpdate(BaseModel):
    """Simplified product update."""

    name: Optional[str] = None
    slug: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    base_price: Optional[float] = Field(None, gt=0)
    mrp: Optional[float] = Field(None, ge=0)
    collection_id: Optional[int] = None
    category_id: Optional[int] = None
    brand: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_new_arrival: Optional[bool] = None

    @model_validator(mode="after")
    def mrp_gte_base_price(self):
        if (
            self.mrp is not None
            and self.base_price is not None
            and self.mrp < self.base_price
        ):
            raise ValueError("MRP must be greater than or equal to selling price")
        return self


class InventoryUpdateRequest(BaseModel):
    """Update inventory stock for a variant."""

    inventory_id: int
    quantity: int = Field(..., ge=0, description="New stock quantity")
    notes: Optional[str] = None


class CategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    display_order: int = 0
    is_active: bool = True
    is_featured: bool = False


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class BulkPriceUpdate(BaseModel):
    product_ids: List[int]
    price: Optional[float] = None
    mrp: Optional[float] = None
    price_adjustment: Optional[float] = None
    price_percentage: Optional[float] = None
    mrp_adjustment: Optional[float] = None
    mrp_percentage: Optional[float] = None
    dry_run: bool = False


class BulkStatusUpdate(BaseModel):
    product_ids: List[int]
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_new_arrival: Optional[bool] = None
    dry_run: bool = False


class BulkCollectionAssign(BaseModel):
    product_ids: List[int]
    collection_id: int
    dry_run: bool = False


class BulkCollectionStatusUpdate(BaseModel):
    ids: List[int]
    is_active: bool


class BulkCollectionReorder(BaseModel):
    items: List[Dict[str, Any]]
