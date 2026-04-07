"""Inventory models for commerce service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Numeric, Text, Boolean, Index
from sqlalchemy.orm import relationship
from database.database import Base


class Inventory(Base):
    """Inventory model for tracking product stock by SKU/variant."""
    __tablename__ = "inventory"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # SKU and variant info
    sku = Column(String(50), unique=True, index=True, nullable=False)
    size = Column(String(20), nullable=True)  # XS, S, M, L, XL, etc.
    color = Column(String(50), nullable=True)
    color_hex = Column(String(7), nullable=True)  # Hex color code e.g. #FF5733
    
    # Stock counts
    quantity = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)  # Reserved for pending orders
    low_stock_threshold = Column(Integer, default=10)
    
    # Variant-specific pricing (overrides product price)
    variant_price = Column(Numeric(10, 2), nullable=True)  # Variant-specific price
    cost_price = Column(Numeric(10, 2), nullable=True)
    description = Column(Text, nullable=True)  # Variant-specific description
    
    # Additional variant attributes
    weight = Column(Numeric(10, 3), nullable=True)  # Weight in kg
    barcode = Column(String(100), nullable=True)  # UPC/EAN barcode
    image_url = Column(String(500), nullable=True) # Variant-specific image
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationship
    product = relationship("Product", back_populates="inventory")
    
    # Unique constraint and Indexes
    __table_args__ = (
        UniqueConstraint('product_id', 'sku', name='uq_inventory_product_sku'),
        Index('idx_inventory_sku_low_stock', 'sku', postgresql_where='quantity <= low_stock_threshold'),
    )
    
    @property
    def available_quantity(self) -> int:
        """Get available (non-reserved) quantity."""
        return max(0, self.quantity - self.reserved_quantity)
    
    @property
    def is_low_stock(self) -> bool:
        """Check if stock is below threshold."""
        return self.available_quantity <= self.low_stock_threshold
    
    @property
    def is_out_of_stock(self) -> bool:
        """Check if completely out of stock."""
        return self.available_quantity <= 0
    
    @property
    def effective_price(self) -> float:
        """Get effective price (variant price or product price)."""
        if self.variant_price is not None:
            return float(self.variant_price)
        if self.product:
            return float(self.product.base_price)
        return 0.0
