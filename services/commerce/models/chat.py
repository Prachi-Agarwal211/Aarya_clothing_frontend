"""Chat models for commerce service."""
from shared.time_utils import ist_naive
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database.database import Base

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(String(50), primary_key=True, index=True) # e.g. UUID
    user_id = Column(Integer, nullable=True, index=True) # logged in user, optional for guests
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: ist_naive())
    updated_at = Column(DateTime, default=lambda: ist_naive(), onupdate=lambda: ist_naive())
    
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(50), ForeignKey("chat_sessions.id"), nullable=False, index=True)
    sender = Column(String(50), nullable=False) # 'customer' or 'admin'
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: ist_naive(), index=True)
    
    session = relationship("ChatSession", back_populates="messages")
