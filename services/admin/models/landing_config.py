"""Landing page configuration models."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, UniqueConstraint
from database.database import Base
from shared.time_utils import ist_naive


class LandingConfig(Base):
    """Landing page section configuration (JSONB-based)."""
    __tablename__ = "landing_config"
    
    id = Column(Integer, primary_key=True, index=True)
    section = Column(String(100), unique=True, nullable=False)
    config = Column(JSON, nullable=False, default={})
    is_active = Column(Boolean, default=True)
    updated_by = Column(Integer)
    created_at = Column(DateTime, default=ist_naive)
    updated_at = Column(DateTime, default=ist_naive, onupdate=ist_naive)


class LandingImage(Base):
    """Landing page media assets."""
    __tablename__ = "landing_images"
    
    id = Column(Integer, primary_key=True, index=True)
    section = Column(String(100), nullable=False, index=True)
    image_url = Column(String(500), nullable=False)
    title = Column(String(255))
    subtitle = Column(String(255))
    link_url = Column(String(500))
    display_order = Column(Integer, default=0)
    device_variant = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=ist_naive)


class LandingProduct(Base):
    """Admin-selected products for landing page sections (e.g. newArrivals)."""
    __tablename__ = "landing_products"

    id = Column(Integer, primary_key=True, index=True)
    section = Column(String(50), nullable=False, index=True)
    product_id = Column(Integer, nullable=False, index=True)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=ist_naive)
    updated_at = Column(DateTime, default=ist_naive, onupdate=ist_naive)

    __table_args__ = (
        UniqueConstraint('section', 'product_id', name='uq_landing_product_section'),
    )
