"""Collection model for commerce service (unified categories = collections)."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from database.database import Base


class Category(Base):
    """Collection model — categories and collections are the same thing.
    
    Backed by the 'collections' table. The class name 'Category' is kept
    for backward compatibility with existing service/schema imports.
    """
    __tablename__ = "collections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    
    # Display settings
    image_url = Column(String(500), nullable=True)  # R2 relative path
    display_order = Column(Integer, default=0)
    
    # Status flags
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    products = relationship("Product", back_populates="category")


# Alias so code can import either name
Collection = Category
