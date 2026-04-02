"""Product models for commerce service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from database.database import Base
from models.collection import Collection  # noqa: F401 — ensure Collection is registered before Product


class Product(Base):
    """Product model."""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=True)
    description = Column(Text, nullable=True)
    short_description = Column(String(500), nullable=True)
    
    # Pricing
    base_price = Column(Numeric(10, 2), nullable=False)
    mrp = Column(Numeric(10, 2), nullable=True)  # Maximum Retail Price
    
    # GST / Tax compliance
    hsn_code = Column(String(10), nullable=True)       # e.g. "6104" for kurtis
    gst_rate = Column(Numeric(5, 2), nullable=True)    # e.g. 5.00 or 12.00 (%)
    is_taxable = Column(Boolean, default=True)         # False for tax-exempt items
    
    # Collection relationship (categories = collections — unified)
    category_id = Column(Integer, ForeignKey("collections.id"), nullable=True, index=True)
    brand = Column(String(100), nullable=True)
    
    # Status flags
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    is_new_arrival = Column(Boolean, default=False)

    # Rating aggregation
    average_rating = Column(Numeric(3, 2), default=0)
    review_count = Column(Integer, default=0)
    
    # SEO
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)

    # Search tags
    tags = Column(String(500), nullable=True)  # Comma-separated tags for search

    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    collection = relationship("Collection", back_populates="products", foreign_keys=[category_id])
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.display_order")
    inventory = relationship("Inventory", back_populates="product", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_products_active_created', is_active, created_at),
        Index('ix_products_category_active', category_id, is_active),
    )

    @property
    def category(self):
        """Backward-compat alias for collection."""
        return self.collection

    @category.setter
    def category(self, value):
        self.collection = value

    @property
    def collection_id(self) -> int:
        """Alias for category_id — collections and categories are unified."""
        return self.category_id

    @collection_id.setter
    def collection_id(self, value):
        self.category_id = value

    @property
    def price(self) -> float:
        """Alias for backward compatibility."""
        return float(self.base_price)

    @property
    def primary_image(self):
        """Get the primary image URL (R2 relative path — backend constructs full URL)."""
        for img in self.images:
            if img.is_primary:
                return img.image_url
        return self.images[0].image_url if self.images else None
    
    @property
    def collection_name(self) -> str:
        """Get collection name."""
        return self.collection.name if self.collection else ""
    
    @property
    def discount_amount(self) -> float:
        """Calculate discount amount."""
        if self.mrp and self.mrp > self.base_price:
            return float(self.mrp - self.base_price)
        return 0.0
    
    @property
    def total_stock(self) -> int:
        """Compute stock from inventory."""
        return sum(inv.available_quantity for inv in self.inventory)
    
    @property
    def is_in_stock(self) -> bool:
        """Check if product is in stock."""
        return self.total_stock > 0
    
    @property
    def stock_status(self) -> str:
        """Get stock status string."""
        if self.total_stock == 0:
            return "out_of_stock"
        elif self.total_stock <= 5:
            return "low_stock"
        return "in_stock"
    
    @property
    def is_on_sale(self) -> bool:
        """Check if product is on sale."""
        return self.mrp is not None and self.mrp > self.base_price
    
    @property
    def discount_percentage(self) -> int:
        """Calculate discount percentage."""
        if self.mrp and self.mrp > self.base_price:
            return int((self.mrp - self.base_price) / self.mrp * 100)
        return 0
