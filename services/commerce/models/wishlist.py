"""Wishlist models for commerce service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from database.database import Base


class Wishlist(Base):
    """Wishlist model for users to save products."""
    __tablename__ = "wishlist"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Timestamps
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationship
    product = relationship("Product")
    
    # Unique constraint: user can only add each product once
    __table_args__ = (
        UniqueConstraint('user_id', 'product_id', name='uq_wishlist_user_product'),
    )
