"""Collection model - canonical grouping of products."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship

from database.database import Base
from shared.time_utils import ist_naive


class Collection(Base):
    """Top-level grouping (e.g. Kurtis, Sarees, Suits & Sets)."""
    __tablename__ = "collections"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(100), nullable=False)
    slug          = Column(String(100), unique=True, index=True, nullable=False)
    description   = Column(Text)
    image_url     = Column(String(500))
    display_order = Column(Integer, default=0)
    is_active     = Column(Boolean, default=True)
    is_featured   = Column(Boolean, default=False)
    created_at    = Column(DateTime, default=ist_naive)
    updated_at    = Column(DateTime, default=ist_naive, onupdate=ist_naive)

    products = relationship("Product", back_populates="collection")
