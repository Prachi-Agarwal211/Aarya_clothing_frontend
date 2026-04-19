"""Order schemas for commerce service."""
from pydantic import BaseModel, computed_field
from typing import Any, List, Optional
from decimal import Decimal
from datetime import datetime


class CartItem(BaseModel):
    """Cart item schema."""
    product_id: int
    quantity: int = 1
    variant_id: Optional[int] = None


class CartItemResponse(BaseModel):
    """Cart item response schema."""
    product_id: int
    variant_id: Optional[int] = None
    name: str
    price: float
    quantity: int
    sku: Optional[str] = None
    image: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None


class CartResponse(BaseModel):
    """Cart response schema."""
    user_id: int
    items: List[CartItemResponse]
    subtotal: float = 0.0
    discount: float = 0.0
    shipping: float = 0.0
    gst_amount: float = 0.0
    cgst_amount: float = 0.0
    sgst_amount: float = 0.0
    igst_amount: float = 0.0
    delivery_state: Optional[str] = None
    customer_gstin: Optional[str] = None
    total: float = 0.0
    total_amount: Optional[float] = None  # Alias for total (for backward compat)
    item_count: int = 0
    reservation_expires_at: Optional[datetime] = None  # UTC timestamp when earliest reservation expires

    class Config:
        from_attributes = True


class SetDeliveryState(BaseModel):
    """Set delivery state for GST calculation."""
    delivery_state: str
    customer_gstin: Optional[str] = None


class OrderCreate(BaseModel):
    """Schema for creating an order (registered users only)."""
    user_id: int = 0  # Optional in request (inferred from token), required for service
    shipping_address: Optional[str] = None
    address_id: Optional[int] = None
    notes: Optional[str] = None
    order_notes: Optional[str] = None  # alias used by route layer
    payment_method: str = "razorpay"
    payment_id: Optional[str] = None       # razorpay payment_id (pay_xxx) after checkout
    transaction_id: Optional[str] = None   # alias for payment_id used by route layer
    razorpay_order_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    # UPI QR payment details
    qr_code_id: Optional[str] = None


class OrderItemResponse(BaseModel):
    """Order item response schema."""
    id: int
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None
    quantity: int
    unit_price: Optional[float] = None
    price: float
    image_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class OrderUpdate(BaseModel):
    """Schema for updating an order."""
    status: Optional[str] = None
    shipping_address: Optional[str] = None


class OrderTrackingResponse(BaseModel):
    """Order tracking response schema."""
    id: Optional[int] = None
    order_id: Optional[int] = None
    status: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    courier_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    """Order response schema."""
    id: int
    user_id: int
    # Customer info (populated for admin views)
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    invoice_number: Optional[str] = None
    subtotal: Optional[Decimal] = None
    shipping_cost: Optional[Decimal] = None
    gst_amount: Optional[Decimal] = None
    cgst_amount: Optional[Decimal] = None
    sgst_amount: Optional[Decimal] = None
    igst_amount: Optional[Decimal] = None
    place_of_supply: Optional[str] = None
    customer_gstin: Optional[str] = None
    total_amount: Decimal
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    status: str
    shipping_address: Optional[str] = None
    order_notes: Optional[str] = None
    tracking_number: Optional[str] = None
    courier_name: Optional[str] = None
    courier_tracking_url: Optional[str] = None
    tracking: Optional[OrderTrackingResponse] = None
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse] = []
    
    @computed_field
    def order_number(self) -> str:
        return f"ORD-{self.id:06d}"
    
    @computed_field
    def items_count(self) -> int:
        return len(self.items)
    
    @computed_field
    def total(self) -> float:
        return float(self.total_amount)

    class Config:
        from_attributes = True


# ==================== Bulk Operation Schemas ====================

class BulkOrderStatusUpdate(BaseModel):
    """Bulk update order status."""
    order_ids: List[int]
    new_status: str
    admin_notes: Optional[str] = None
    dry_run: bool = False


class GuestOrderTrackItem(BaseModel):
    """Line item for public tracking page (minimal fields)."""

    product_name: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int
    price: float


class GuestOrderTrackResponse(BaseModel):
    """Public order snapshot for signed guest tracking links."""

    order_id: int
    status: str
    tracking_number: Optional[str] = None
    total_amount: float
    created_at: datetime
    items: List[GuestOrderTrackItem] = []

