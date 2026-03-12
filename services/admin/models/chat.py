"""Chat models for customer support."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum
import enum
from database.database import Base


class ChatStatus(str, enum.Enum):
    OPEN = "open"
    ASSIGNED = "assigned"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SenderType(str, enum.Enum):
    CUSTOMER = "customer"
    STAFF = "staff"
    ADMIN = "admin"
    SYSTEM = "system"


class ChatRoom(Base):
    """Customer support chat room."""
    __tablename__ = "chat_rooms"
    
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, nullable=False, index=True)
    customer_name = Column(String(100))
    customer_email = Column(String(255))
    assigned_to = Column(Integer, index=True)
    subject = Column(String(255))
    status = Column(Enum(ChatStatus, native_enum=False, length=20), default=ChatStatus.OPEN, index=True)
    priority = Column(String(20), default="medium")
    order_id = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    closed_at = Column(DateTime)


class ChatMessage(Base):
    """Individual chat message."""
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, nullable=False, index=True)
    sender_id = Column(Integer)
    sender_type = Column(Enum(SenderType, native_enum=False, length=20), default=SenderType.CUSTOMER)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
