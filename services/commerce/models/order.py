"""Order models for commerce service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Enum, Index
from sqlalchemy.orm import relationship
import enum
from database.database import Base


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
    user_id = Column(Integer, nullable=False, index=True)
    
    # Payment integration
    transaction_id = Column(String(255), nullable=True, index=True)  # Links to payment service
    
    # Invoice
    invoice_number = Column(String(50), nullable=True, unique=True, index=True)  # e.g. INV-2026-000001
    
    # Pricing
    subtotal = Column(Numeric(10, 2), nullable=False)
    discount_applied = Column(Numeric(10, 2), default=0)
    promo_code = Column(String(50), nullable=True)
    shipping_cost = Column(Numeric(10, 2), default=0)
    
    # GST breakdown
    gst_amount = Column(Numeric(10, 2), default=0)      # total GST
    cgst_amount = Column(Numeric(10, 2), default=0)     # Central GST (intra-state)
    sgst_amount = Column(Numeric(10, 2), default=0)     # State GST (intra-state)
    igst_amount = Column(Numeric(10, 2), default=0)     # Integrated GST (inter-state)
    place_of_supply = Column(String(50), nullable=True) # delivery state
    customer_gstin = Column(String(15), nullable=True)  # B2B GSTIN
    
    total_amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(50), default='cashfree')
    
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
    
    # Notes
    order_notes = Column(Text, nullable=True)
    
    # Cancellation
    cancelled_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
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
        Index('ix_orders_status_created', status, created_at),
        Index('ix_orders_user_created', user_id, created_at),
    )



class OrderItem(Base):
    """Order item model with inventory tracking."""
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=True, index=True)
    
    # Snapshot fields
    product_id = Column(Integer, nullable=True)
    product_name = Column(String(255), nullable=True)
    sku = Column(String(100), nullable=True)
    size = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    hsn_code = Column(String(10), nullable=True)   # GST HSN code snapshot
    gst_rate = Column(Numeric(5, 2), nullable=True) # GST rate snapshot at time of order
    
    # Pricing
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    price = Column(Numeric(10, 2), nullable=False) # total price for this item (unit_price * quantity)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    order = relationship("Order", back_populates="items")
    inventory = relationship("Inventory", foreign_keys=[inventory_id])
    product = relationship("Product", foreign_keys=[product_id], primaryjoin="OrderItem.product_id == Product.id", viewonly=True)

