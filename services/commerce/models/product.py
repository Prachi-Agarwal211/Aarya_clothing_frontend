"""Product model aligned with existing DB schema."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship

from database.database import Base
from shared.time_utils import ist_naive
from models.collection import Collection  # noqa: F401 - register before Product


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=False)
    short_description = Column(Text, nullable=True)
    base_price = Column(Numeric(10, 2), nullable=False)
    mrp = Column(Numeric(10, 2), nullable=True)
    category_id = Column(Integer, ForeignKey("collections.id", ondelete="RESTRICT"), nullable=False, index=True)
    brand = Column(String(100), nullable=True)
    hsn_code = Column(String(20), nullable=True)
    gst_rate = Column(Numeric(5, 2), nullable=True)
    is_taxable = Column(Boolean, default=True)
    average_rating = Column(Numeric(3, 2), default=0)
    review_count = Column(Integer, default=0)
    total_stock = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    is_new_arrival = Column(Boolean, default=False)
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)
    material = Column(String(255), nullable=True)
    care_instructions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=ist_naive)
    updated_at = Column(DateTime, default=ist_naive, onupdate=ist_naive)

    collection = relationship("Collection", back_populates="products")
    images = relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.display_order",
    )
    variants = relationship(
        "ProductVariant",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductVariant.id",
    )

    @property
    def price(self):
        """Compatibility alias for code expecting `price`."""
        return self.base_price

    @price.setter
    def price(self, value):
        self.base_price = value

    @property
    def collection_id(self):
        return self.category_id

    @collection_id.setter
    def collection_id(self, value):
        self.category_id = value

    @property
    def category(self):
        return self.collection

    @category.setter
    def category(self, value):
        self.collection = value

    @property
    def inventory(self):
        return self.variants

    @property
    def primary_image(self):
        """DB has no products.primary_image; derive from product_images."""
        if not self.images:
            return None
        primary = next((img for img in self.images if getattr(img, "is_primary", False)), None)
        return (primary or self.images[0]).image_url

    @property
    def tags(self):
        return None

    @property
    def discount_amount(self) -> float:
        return 0.0

    @property
    def discount_percentage(self) -> int:
        return 0

    @property
    def is_on_sale(self) -> bool:
        return False
