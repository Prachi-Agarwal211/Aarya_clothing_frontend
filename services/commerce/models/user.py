"""Local ORM mappings for shared user tables used by commerce queries."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum

from shared.time_utils import ist_naive
import enum
from database.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    STAFF = "staff"
    CUSTOMER = "customer"
    SUPER_ADMIN = "super_admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(101), nullable=True)
    phone = Column(String(20), nullable=True)
    role = Column(
        Enum(
            UserRole,
            native_enum=False,
            length=20,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=UserRole.CUSTOMER,
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: ist_naive(), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: ist_naive(),
        onupdate=lambda: ist_naive(),
        nullable=False,
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    full_name = Column(String(101), nullable=True)
    phone = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=lambda: ist_naive(), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: ist_naive(),
        onupdate=lambda: ist_naive(),
        nullable=False,
    )