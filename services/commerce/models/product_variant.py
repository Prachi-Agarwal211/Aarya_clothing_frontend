"""Inventory-backed product variant model for current schema."""
import hashlib
import re

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship

from database.database import Base
from shared.time_utils import ist_naive
from shared.storage.utils import get_r2_public_url


class ProductVariant(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    sku = Column(String(64), unique=True, index=True, nullable=False)
    size = Column(String(32), nullable=True)
    color = Column(String(64), nullable=True)
    color_hex = Column(String(7), nullable=True)
    quantity = Column(Integer, nullable=False, default=0)
    reserved_quantity = Column(Integer, nullable=False, default=0)
    low_stock_threshold = Column(Integer, nullable=False, default=5)
    cost_price = Column(Numeric(10, 2), nullable=True)
    variant_price = Column(Numeric(10, 2), nullable=True)
    description = Column(String(500), nullable=True)
    weight = Column(Numeric(10, 3), nullable=True)
    location = Column(String(100), nullable=True)
    barcode = Column(String(100), nullable=True)
    image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=ist_naive)
    updated_at = Column(DateTime, default=ist_naive, onupdate=ist_naive)

    product = relationship("Product", back_populates="variants")

    # ---- Helpers -----------------------------------------------------------

    @property
    def resolved_image_url(self):
        """Resolves variant image, falling back to product primary image if missing."""
        if self.image_url:
            return get_r2_public_url(self.image_url)
        return self.product.primary_image if self.product else None

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
    def resolved_color_hex(self):
        """Stable color hex used by APIs when color_hex column is empty."""
        explicit_hex = (self.color_hex or "").strip()
        if re.match(r"^#[0-9a-fA-F]{6}$", explicit_hex):
            return explicit_hex.upper()

        color = (self.color or "").strip()
        if not color:
            return "#9CA3AF"
            
        # If admins entered a hex into the color field, honor it.
        if re.match(r"^#[0-9a-fA-F]{6}$", color):
            return color.upper()

        from shared.color_utils import get_hex_from_name
        hex_from_name = get_hex_from_name(color)
        if hex_from_name:
            return hex_from_name.upper()

        normalized = re.sub(r"\s+", " ", color.lower())
        digest = hashlib.md5(normalized.encode("utf-8")).hexdigest()
        return f"#{digest[:6].upper()}"

    @property
    def effective_price(self) -> float:
        """Prefer variant price, then fall back to product base price."""
        if self.variant_price is not None:
            return float(self.variant_price)
        return float(self.product.base_price) if self.product else 0.0
