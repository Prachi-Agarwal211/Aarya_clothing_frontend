"""Models for Core Platform Service."""
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from database.database import Base


class UserRole(str, enum.Enum):
    """User role enumeration."""
    admin = "admin"
    staff = "staff"
    customer = "customer"
    super_admin = "super_admin"


class User(Base):
    """User model for authentication and profile management."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, native_enum=False, length=20), default=UserRole.customer, nullable=False)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)
    # How the user chose to verify at signup: link | otp_email | otp_sms (drives login recovery resend)
    signup_verification_method = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    security = relationship("UserSecurity", back_populates="user", uselist=False, cascade="all, delete-orphan")
    verifications = relationship("EmailVerification", back_populates="user", cascade="all, delete-orphan")
    
    @property
    def is_super_admin(self) -> bool:
        """Check if user is super admin."""
        return self.role == UserRole.super_admin

    @property
    def is_admin(self) -> bool:
        """Backward compatibility: check if user is admin."""
        return self.role == UserRole.admin
    
    @property
    def is_staff(self) -> bool:
        """Check if user is staff or admin (has backend access)."""
        return self.role in [UserRole.staff, UserRole.admin, UserRole.super_admin]
    
    @property
    def is_customer(self) -> bool:
        """Check if user is customer."""
        return self.role == UserRole.customer
