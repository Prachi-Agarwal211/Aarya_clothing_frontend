"""Order models for commerce service."""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Enum, Index, UniqueConstraint
from sqlalchemy.orm import relationship
import enum
from database.database import Base
from shared.time_utils import ist_naive


class OrderStatus(str, enum.Enum):
    """
    Order status enumeration.
    
    State machine:
    CONFIRMED → SHIPPED (admin sets with POD number) → DELIVERED
    CONFIRMED → CANCELLED (customer or admin)
    
    Customer display:
    - CONFIRMED   → "Processing your order"
    - SHIPPED     → "Shipped — Track with POD number"
    - DELIVERED   → "Delivered"
    - CANCELLED   → "Order Cancelled"
    
    Note: RETURNED / REFUNDED are handled by the Returns module (separate entity).
    """
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Order(Base):
    """Order model with comprehensive tracking."""
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User relationship - ForeignKey to users table (shared with Core service)
    user_id = Column(Integer, nullable=True, index=True)  # nullable for guest orders
    
    # Payment integration
    transaction_id = Column(String(255), nullable=True, index=True)  # Links to payment service

    # Razorpay payment details
    razorpay_order_id = Column(String(100), nullable=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    
    # Invoice
    invoice_number = Column(String(50), nullable=True, unique=True, index=True)  # e.g. INV-2026-000001
    
    # Pricing
    subtotal = Column(Numeric(10, 2), nullable=False)
    shipping_cost = Column(Numeric(10, 2), default=0)
    
    # GST breakdown
    gst_amount = Column(Numeric(10, 2), default=0)      # total GST
    cgst_amount = Column(Numeric(10, 2), default=0)     # Central GST (intra-state)
    sgst_amount = Column(Numeric(10, 2), default=0)     # State GST (intra-state)
    igst_amount = Column(Numeric(10, 2), default=0)     # Integrated GST (inter-state)
    place_of_supply = Column(String(50), nullable=True) # delivery state
    customer_gstin = Column(String(15), nullable=True)  # B2B GSTIN
    
    total_amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(50), default='razorpay')
    
    # Status
    status = Column(
        Enum(
            OrderStatus,
            native_enum=False,
            length=20,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=OrderStatus.CONFIRMED,
        nullable=False,
        index=True
    )
    
    # Shipping - using address_id instead of text
    shipping_address_id = Column(
        Integer, 
        ForeignKey("addresses.id", ondelete="SET NULL"),
        nullable=True
    )
    # Address snapshot (text)
    shipping_address = Column(Text, nullable=True)
    
    billing_address_id = Column(
        Integer, 
        ForeignKey("addresses.id", ondelete="SET NULL"),
        nullable=True
    )
    shipping_method = Column(String(100), default='standard')
    tracking_number = Column(String(100), nullable=True)
    
    # Courier service fields
    courier_name = Column(String(100), nullable=True)
    courier_tracking_url = Column(String(500), nullable=True)

    # Notes
    order_notes = Column(Text, nullable=True)
    
    # Cancellation
    cancelled_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=ist_naive, index=True)
    updated_at = Column(DateTime, default=ist_naive, onupdate=ist_naive)
    shipped_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    
    # Relationships
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    shipping_address_ref = relationship("Address", foreign_keys=[shipping_address_id], backref="shipping_orders")
    billing_address_ref = relationship("Address", foreign_keys=[billing_address_id], backref="billing_orders")
    tracking = relationship("OrderTracking", back_populates="order", cascade="all, delete-orphan", uselist=False)
    
    # Transient fields for customer info (populated by service layer)
    customer_name = None
    customer_email = None

    __table_args__ = (
        # Unique constraint to prevent duplicate orders from same payment
        UniqueConstraint('transaction_id', 'user_id', name='uq_order_transaction_user'),

        # Existing indexes
        Index('ix_orders_status_created', 'status', 'created_at'),
        Index('ix_orders_user_created', 'user_id', 'created_at'),
        Index('ix_orders_shipping_address', 'shipping_address_id'),
        Index('ix_orders_billing_address', 'billing_address_id'),
        Index('ix_orders_payment_method', 'payment_method'),
    )



class OrderItem(Base):
    """Order item - snapshot of variant + product at the time of purchase."""
    __tablename__ = "order_items"

    id           = Column(Integer, primary_key=True, index=True)
    order_id     = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id   = Column(Integer, ForeignKey("inventory.id"), nullable=False, index=True)
    product_id   = Column(Integer, ForeignKey("products.id"), nullable=False)

    # Snapshot at purchase time (so renames/deletes don't break old orders)
    product_name = Column(String(255), nullable=False)
    sku          = Column(String(64),  nullable=False)
    size         = Column(String(16),  nullable=True)
    color        = Column(String(32),  nullable=True)
    color_hex    = Column(String(7),   nullable=True)
    image_url    = Column(String(500), nullable=True)

    quantity     = Column(Integer,        nullable=False, default=1)
    unit_price   = Column(Numeric(10, 2), nullable=False)
    line_total   = Column(Numeric(10, 2), nullable=False)

    created_at   = Column(DateTime, default=ist_naive)

    order   = relationship("Order", back_populates="items")
    variant = relationship("ProductVariant", foreign_keys=[variant_id])
    product = relationship("Product", foreign_keys=[product_id], viewonly=True)

    # ---- Back-compat shims for legacy readers ------------------------------
    # admin_analytics_service.py and a few historical readers still reference
    # `.price` / `.inventory_id` / `.hsn_code` / `.gst_rate`. Expose the new
    # columns behind the old names until those callers are migrated.
    @property
    def price(self):
        return self.line_total

    @property
    def inventory_id(self):
        return self.variant_id

    @property
    def hsn_code(self):
        return getattr(self.product, "hsn_code", None) if self.product else None

    @property
    def gst_rate(self):
        return getattr(self.product, "gst_rate", None) if self.product else None

