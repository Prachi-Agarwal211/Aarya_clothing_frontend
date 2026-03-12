"""User model for commerce service (read-only, mirrors core User)."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from database.database import Base
from datetime import datetime, timezone
import enum


class UserRole(str, enum.Enum):
    """User role enumeration."""
    customer = "customer"
    staff = "staff"
    admin = "admin"


class User(Base):
    """User model for reading user data in commerce service."""
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, native_enum=False, length=20), default=UserRole.customer, nullable=False)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationship to profile (optional - not always loaded)
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    
    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.admin
    
    @property
    def is_staff(self) -> bool:
        return self.role in [UserRole.staff, UserRole.admin]
    
    @property
    def full_name(self) -> str:
        """Get full name from profile if available."""
        if self.profile and self.profile.full_name:
            return self.profile.full_name
        return self.username


class UserProfile(Base):
    """User profile model for commerce service."""
    __tablename__ = "user_profiles"
    __table_args__ = {'extend_existing': True}
    
    # In core, user_id is the primary key, not id.
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    date_of_birth = Column(DateTime, nullable=True)
    gender = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationship
    user = relationship("User", back_populates="profile")
