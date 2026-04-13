"""Review models for commerce service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index, ARRAY
from sqlalchemy.orm import relationship
from database.database import Base


class Review(Base):
    """Product review model with moderation support."""
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)  # FK to users in core service
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)  # Links to verified purchase

    # Review content
    rating = Column(Integer, nullable=False)  # 1-5 stars
    title = Column(String(200), nullable=True)
    comment = Column(Text, nullable=True)

    # Review images (array of R2 URLs)
    image_urls = Column(ARRAY(String), nullable=True, default=[])

    # Verification & moderation
    is_verified_purchase = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)  # For moderation

    # Engagement
    helpful_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    product = relationship("Product", foreign_keys=[product_id])
    order = relationship("Order", foreign_keys=[order_id])

    __table_args__ = (
        Index('ix_reviews_product_rating', product_id, rating, created_at),
    )
