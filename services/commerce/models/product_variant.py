"""ProductVariant - the single source of truth for stock + per-color image.

Replaces the old `inventory` + `variant_images` tables. One variant = one
(size, color) combination. Customer-facing: when the customer picks a color
the storefront swaps the displayed image to this variant's `image_url`.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, Index, CheckConstraint
from sqlalchemy.orm import relationship

from database.database import Base
from shared.time_utils import ist_naive


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id                  = Column(Integer, primary_key=True, index=True)
    product_id          = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    sku                 = Column(String(64), unique=True, index=True, nullable=False)
    size                = Column(String(16), nullable=False)
    color               = Column(String(32), nullable=False)
    color_hex           = Column(String(7))
    image_url           = Column(String(500), nullable=False)
    quantity            = Column(Integer, nullable=False, default=0)
    reserved_quantity   = Column(Integer, nullable=False, default=0)
    low_stock_threshold = Column(Integer, nullable=False, default=5)
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime, default=ist_naive)
    updated_at          = Column(DateTime, default=ist_naive, onupdate=ist_naive)

    product   = relationship("Product", back_populates="variants")
    movements = relationship(
        "InventoryMovement",
        back_populates="variant",
        cascade="all, delete-orphan",
        order_by="InventoryMovement.created_at.desc()",
    )

    __table_args__ = (
        UniqueConstraint("product_id", "size", "color", name="uq_variant_product_size_color"),
        CheckConstraint("quantity >= 0",            name="ck_variant_quantity_nonneg"),
        CheckConstraint("reserved_quantity >= 0",   name="ck_variant_reserved_nonneg"),
        CheckConstraint("low_stock_threshold >= 0", name="ck_variant_threshold_nonneg"),
        Index("idx_variants_low_stock", "product_id", postgresql_where="quantity <= low_stock_threshold"),
    )

    # ---- Helpers -----------------------------------------------------------

    @property
    def available_quantity(self) -> int:
        return max(0, self.quantity - self.reserved_quantity)

    @property
    def is_low_stock(self) -> bool:
        return self.available_quantity <= self.low_stock_threshold

    @property
    def is_out_of_stock(self) -> bool:
        return self.available_quantity == 0

    @property
    def in_stock(self) -> bool:
        return self.is_active and self.available_quantity > 0

    @property
    def effective_price(self) -> float:
        """MRP and selling price are the same: always defer to product price."""
        return float(self.product.price) if self.product else 0.0
