"""Return request models for commerce service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
import enum
from database.database import Base


class ReturnReason(str, enum.Enum):
    """Return reason enumeration."""
    DEFECTIVE = "defective"
    WRONG_ITEM = "wrong_item"
    NOT_AS_DESCRIBED = "not_as_described"
    SIZE_ISSUE = "size_issue"
    COLOR_ISSUE = "color_issue"
    CHANGED_MIND = "changed_mind"
    OTHER = "other"


class ReturnStatus(str, enum.Enum):
    """Return status enumeration."""
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    RECEIVED = "received"
    REFUNDED = "refunded"


class ReturnType(str, enum.Enum):
    """Return type enumeration."""
    RETURN = "return"
    EXCHANGE = "exchange"


class ReturnRequest(Base):
    """Return/refchange request model."""
    __tablename__ = "return_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    
    # Return details
    reason = Column(Enum(ReturnReason, native_enum=False, length=20), nullable=False)
    type = Column(Enum(ReturnType, native_enum=False, length=20), default=ReturnType.RETURN, nullable=False)
    items = Column('items', Text, nullable=True)  # JSONB array stored as text, nullable=True
    description = Column(Text, nullable=True)
    status = Column(Enum(ReturnStatus, native_enum=False, length=20), default=ReturnStatus.REQUESTED, nullable=False)
    
    # Enhanced return fields
    exchange_preference = Column(String(255), nullable=True)  # exchange, refund, store_credit
    video_url = Column(Text, nullable=True)  # URL of uploaded video
    
    # Financial
    refund_amount = Column(Numeric(10, 2), nullable=True)
    refund_transaction_id = Column(String(255), nullable=True)  # Links to payment service
    
    # Processing
    approved_by = Column(Integer, nullable=True)  # Staff user ID
    rejection_reason = Column(Text, nullable=True)
    
    # Return shipping
    return_tracking_number = Column(String(100), nullable=True)
    is_item_received = Column(Boolean, default=False)
    
    # Timestamps
    requested_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    approved_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)
    refunded_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    order = relationship("Order", foreign_keys=[order_id])
