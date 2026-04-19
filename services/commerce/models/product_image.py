"""ProductImage - optional gallery extras for a product (hero image lives on `products.primary_image`)."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from database.database import Base
from shared.time_utils import ist_naive


class ProductImage(Base):
    __tablename__ = "product_images"

    id            = Column(Integer, primary_key=True, index=True)
    product_id    = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url     = Column(String(500), nullable=False)
    display_order = Column(Integer, default=0)
    created_at    = Column(DateTime, default=ist_naive)

    product = relationship("Product", back_populates="images")
