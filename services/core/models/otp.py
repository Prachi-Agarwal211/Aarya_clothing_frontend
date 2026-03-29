"""OTP model for verification."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from database.database import Base


class OTP(Base):
    """OTP model for email/phone verification."""
    __tablename__ = "otps"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # OTP code
    otp_code = Column(String(10), nullable=False)
    
    # User reference (optional - for unauthenticated flows)
    user_id = Column(Integer, nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    
    # OTP details
    otp_type = Column(String(20), nullable=False)  # email_verification, phone_verification, password_reset, login
    purpose = Column(String(50), nullable=False)  # verify, reset, login
    
    # Status
    is_used = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    
    # Metadata
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
