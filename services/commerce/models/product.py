"""Product model - clean nested schema.

Hierarchy:
    Collection 1->N Product
    Product    1->N ProductImage   (gallery extras)
    Product    1->N ProductVariant (size + color + qty + image)
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, ForeignKey, Index
from sqlalchemy.orm import relationship

from database.database import Base
from shared.time_utils import ist_naive
from models.collection import Collection  # noqa: F401 - register before Product


class Product(Base):
    __tablename__ = "products"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(255), nullable=False)
    slug          = Column(String(255), unique=True, index=True, nullable=False)
    description   = Column(Text, nullable=False)
    price         = Column(Numeric(10, 2), nullable=False)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="RESTRICT"), nullable=False, index=True)
    primary_image = Column(String(500), nullable=False)
    is_active     = Column(Boolean, default=True)
    is_featured   = Column(Boolean, default=False)
    created_at    = Column(DateTime, default=ist_naive)
    updated_at    = Column(DateTime, default=ist_naive, onupdate=ist_naive)

    collection = relationship("Collection", back_populates="products")
    images     = relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.display_order",
    )
    variants   = relationship(
        "ProductVariant",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductVariant.id",
    )

    __table_args__ = (
        Index("ix_products_active_created",    is_active, created_at),
        Index("ix_products_collection_active", collection_id, is_active),
    )

    # ---- Computed helpers (no DB columns) ----------------------------------

    @property
    def total_stock(self) -> int:
        return sum(v.available_quantity for v in self.variants if v.is_active)

    @property
    def is_in_stock(self) -> bool:
        return self.total_stock > 0

    @property
    def stock_status(self) -> str:
        total = self.total_stock
        if total == 0:
            return "out_of_stock"
        if total <= 5:
            return "low_stock"
        return "in_stock"

    @property
    def collection_name(self) -> str:
        return self.collection.name if self.collection else ""

    # ---- Back-compat aliases (old code still references these) -------------
    # MRP and selling price are the same per product spec.
    @property
    def base_price(self):
        return self.price

    @base_price.setter
    def base_price(self, value):
        self.price = value

    @property
    def mrp(self):
        return self.price

    @mrp.setter
    def mrp(self, value):
        self.price = value

    @property
    def category_id(self):
        return self.collection_id

    @category_id.setter
    def category_id(self, value):
        self.collection_id = value

    @property
    def category(self):
        return self.collection

    @category.setter
    def category(self, value):
        self.collection = value

    @property
    def inventory(self):
        """Back-compat alias - prefer `variants`."""
        return self.variants

    @property
    def discount_amount(self) -> float:
        return 0.0

    @property
    def discount_percentage(self) -> int:
        return 0

    @property
    def is_on_sale(self) -> bool:
        return False

    # GST / HSN / brand / short_description were dropped from the simplified
    # product model (per the production rebuild). Phase 2 sweeps the call
    # sites; in the meantime, return safe defaults so legacy code paths in
    # commerce/main.py + order_service.py don't crash with AttributeError.
    @property
    def hsn_code(self):
        return None

    @property
    def gst_rate(self):
        return None

    @property
    def brand(self):
        return None

    @property
    def short_description(self):
        return None
