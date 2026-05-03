"""
Consolidated User Model - Single source of truth for all user data
Replaces duplicate models in both Core and Commerce services
Cleaned up version - removed all unused columns
"""
from datetime import datetime
from shared.time_utils import ist_naive
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from database.database import Base
from enum import Enum as PyEnum
import bcrypt

class UserRole(str, PyEnum):
    """Unified user roles across all services"""
    admin = "admin"
    staff = "staff"
    customer = "customer"
    super_admin = "super_admin"

class User(Base):
    """
    Consolidated User Model - Single table for all user data
    Replaces: core.models.user.User and commerce.models.user.User
    Cleaned up: removed unused columns (avatar_url, date_of_birth, last_login_ip, etc.)
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Consolidated fields (previously in user_profiles) - cleaned up
    first_name = Column(String(50), nullable=True)
    last_name = Column(String(50), nullable=True)
    full_name = Column(String(101), nullable=True)
    phone = Column(String(20), unique=True, nullable=True)
    # Removed unused columns: avatar_url, date_of_birth
    
    # Core authentication fields
    is_active = Column(Boolean, default=True, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    phone_verified = Column(Boolean, default=False, nullable=False)
    signup_verification_method = Column(String(20), nullable=True)
    
    # Security fields (previously in user_security) - cleaned up
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    account_locked_until = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)
    # Removed unused columns: last_login_ip, password_history
    
    # Role and timestamps
    role = Column(Enum(UserRole), default=UserRole.customer, nullable=False)
    created_at = Column(DateTime, default=ist_naive, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=ist_naive, onupdate=ist_naive, server_default=func.now(), nullable=False)
    
    # Relationships
    addresses: Mapped[List["Address"]] = relationship(
        "Address", back_populates="user", 
        cascade="all, delete-orphan"
    )
    
    orders: Mapped[List["Order"]] = relationship(
        "Order", back_populates="user",
        cascade="all, delete-orphan"
    )
    
    reviews: Mapped[List["Review"]] = relationship(
        "Review", back_populates="user",
        cascade="all, delete-orphan"
    )
    
    verifications: Mapped[List["EmailVerification"]] = relationship(
        "EmailVerification", back_populates="user",
        cascade="all, delete-orphan"
    )
    
    def verify_password(self, password: str) -> bool:
        """Verify password against hashed password"""
        return bcrypt.checkpw(password.encode('utf-8'), self.hashed_password.encode('utf-8'))
    
    def set_password(self, password: str) -> None:
        """Set password with bcrypt hashing"""
        salt = bcrypt.gensalt()
        self.hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def is_locked(self) -> bool:
        """Check if account is locked"""
        return self.account_locked_until is not None and self.account_locked_until > ist_naive()

    @property
    def profile(self):
        """Back-compat shim — `user_profiles` is gone, phone/full_name live on User now.

        Old code paths still call ``user.profile.phone`` / ``user.profile.full_name``;
        return a tiny namespace so they keep working without an ORM round-trip.
        """
        from types import SimpleNamespace
        return SimpleNamespace(
            phone=self.phone,
            full_name=self.full_name,
        )

class Address(Base):
    """Addresses - moved from core to core (consolidated)"""
    __tablename__ = "addresses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    address_type = Column(String(20), default="shipping")
    full_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    pincode = Column(String(20), nullable=False)
    country = Column(String(100), default="India")
    is_default = Column(Boolean, default=False)
    
    user: Mapped["User"] = relationship("User", back_populates="addresses")

class Review(Base):
    """Reviews - moved from commerce to core"""
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    is_verified_purchase = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    user: Mapped["User"] = relationship("User", back_populates="reviews")

class Order(Base):
    """Orders - moved from commerce to core"""
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # Legacy databases may still use invoice_number and miss order_number.
    order_number = Column(String(50), unique=True, nullable=True)
    status = Column(String(50), nullable=False)
    total_amount = Column(Integer, nullable=False)  # in cents
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    user: Mapped["User"] = relationship("User", back_populates="orders")

class VerificationToken(Base):
    """OTP verification tokens - cleaned up version"""
    __tablename__ = "verification_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(6), nullable=False)  # 6-digit OTP
    token_type = Column(String(50), nullable=False)  # email_verification, password_reset, etc.
    delivery_method = Column(String(20), nullable=True)  # EMAIL | SMS | WHATSAPP
    expires_at = Column(DateTime, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=ist_naive, server_default=func.now(), nullable=False)
    # Removed unused column: ip_address
    
    user: Mapped["User"] = relationship("User")


class TrustedDevice(Base):
    """
    Devices the user has explicitly verified via OTP.

    Lookup key is `(user_id, fingerprint)`. When a login request arrives
    with a fingerprint that already exists for that user we treat the
    device as trusted and may skip the second-factor OTP challenge.
    The fingerprint is the sha256 of UA + screen + language + timezone
    computed client-side; we never store raw browser data here.
    """
    __tablename__ = "trusted_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    fingerprint = Column(String(128), nullable=False, index=True)
    device_name = Column(String(120), nullable=True)
    last_ip = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    last_seen_at = Column(DateTime, server_default=func.now(), nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User")
