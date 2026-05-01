"""Core Platform Service - Aarya Clothing"""
from .otp import OTP
from .user_consolidated import (
    User,
    UserRole,
    Address,
    Review,
    Order,
    VerificationToken,
    TrustedDevice,
)
# UserProfile is deprecated - fields moved to User model
# from .user_profile import UserProfile
# UserSecurity is deprecated - fields moved to User model
# from .user_security import UserSecurity
from .email_verification import EmailVerification

__all__ = [
    "User",
    "OTP",
    # "UserProfile",  # Deprecated - fields moved to User model
    # "UserSecurity",  # Deprecated - fields moved to User model
    "EmailVerification",
    "Address",
    "Review",
    "Order",
    "VerificationToken",
    "TrustedDevice",
]