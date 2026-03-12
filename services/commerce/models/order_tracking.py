"""Order tracking models for commerce service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Index
from sqlalchemy.orm import relationship
from database.database import Base
from .order import OrderStatus


class OrderTracking(Base):
    """Order tracking/history model for status changes."""
    __tablename__ = "order_tracking"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Status information
    status = Column(
        Enum(
            OrderStatus,
            native_enum=False,
            length=20,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False
    )
    location = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Staff tracking
    updated_by = Column(Integer, nullable=True)  # Staff user ID who made the update
    
    # Timestamp
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    # Relationships
    order = relationship("Order", foreign_keys=[order_id])

    __table_args__ = (
        Index('ix_order_tracking_order_status', order_id, status, created_at),
    )
