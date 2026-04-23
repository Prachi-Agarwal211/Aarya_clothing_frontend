"""Inventory-backed product variant model for current schema."""
import hashlib
import re

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship

from database.database import Base
from shared.time_utils import ist_naive


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

        name_map = {
            "black": "#000000",
            "white": "#FFFFFF",
            "red": "#DC2626",
            "maroon": "#800000",
            "pink": "#EC4899",
            "rose": "#F43F5E",
            "peach": "#FFDAB9",
            "coral": "#FF7F50",
            "orange": "#F97316",
            "rust": "#B7410E",
            "mustard": "#E3A849",
            "gold": "#FFD700",
            "yellow": "#EAB308",
            "lime": "#84CC16",
            "green": "#22C55E",
            "sea green": "#2E8B57",
            "olive": "#808000",
            "teal": "#14B8A6",
            "turquoise": "#40E0D0",
            "sky blue": "#87CEEB",
            "blue": "#3B82F6",
            "navy": "#1E3A5F",
            "navy blue": "#1E3A5F",
            "purple": "#A855F7",
            "lavender": "#E6E6FA",
            "lilac": "#C8A2C8",
            "mauve": "#E0B0FF",
            "magenta": "#FF00FF",
            "wine": "#722F37",
            "burgundy": "#800020",
            "brown": "#92400E",
            "beige": "#F5F5DC",
            "ivory": "#FFFFF0",
            "cream": "#FFFDD0",
            "grey": "#9CA3AF",
            "gray": "#9CA3AF",
            "silver": "#C0C0C0",
            "charcoal": "#36454F",
            "default": "#9CA3AF",
        }
        normalized = re.sub(r"\s+", " ", color.lower())
        if normalized in name_map:
            return name_map[normalized]

        digest = hashlib.md5(normalized.encode("utf-8")).hexdigest()
        return f"#{digest[:6].upper()}"

    @property
    def effective_price(self) -> float:
        """Prefer variant price, then fall back to product base price."""
        if self.variant_price is not None:
            return float(self.variant_price)
        return float(self.product.base_price) if self.product else 0.0
