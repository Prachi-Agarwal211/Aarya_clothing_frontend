from sqlalchemy import Column, Integer, DateTime, String, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from shared.time_utils import ist_naive
from database.database import Base

class UserSecurity(Base):
    __tablename__ = "user_security"

    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    last_login_ip = Column(String(45), nullable=True)
    password_history = Column(JSON, default=[])
    last_password_change = Column(DateTime, default=ist_naive)
    created_at = Column(DateTime, default=ist_naive)
    updated_at = Column(DateTime, default=ist_naive, onupdate=ist_naive)

    user = relationship("User", back_populates="security")
