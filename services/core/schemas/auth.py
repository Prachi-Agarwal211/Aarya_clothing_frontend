"""Schemas for authentication."""

from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, computed_field, validator, model_validator
from typing import Optional
from enum import Enum
from models.user import UserRole


class VerificationMethod(str, Enum):
    """
    Verification method for registration.

    ACTIVE (Supported):
    - link: Email link verification (recommended, industry standard)
    - otp_sms: SMS OTP verification (6-digit code)
    - otp_email: Email OTP verification (6-digit code)

    User selects one method during registration. System routes verification accordingly.
    """

    link = "link"  # Email link (recommended, default)
    otp_email = "otp_email"  # Email OTP (6-digit code)
    otp_sms = "otp_sms"  # SMS OTP (6-digit code)
    otp_whatsapp = "otp_whatsapp"  # WhatsApp OTP (6-digit code)


# ==================== User Schemas ====================

# ==================== User Profile Schemas ====================


class UserProfileBase(BaseModel):
    """Base schema for user profile."""

    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: str = Field(
        ..., min_length=10, max_length=20, description="Phone number is required"
    )


class UserProfileResponse(UserProfileBase):
    """Schema for user profile response."""

    class Config:
        from_attributes = True


class UserProfileUpdate(UserProfileBase):
    """Schema for updating user profile."""

    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(
        None, min_length=10, max_length=20, description="Phone number (optional)"
    )


class UserBase(BaseModel):
    """Base user schema, containing only core user fields."""

    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)


class UserCreate(UserBase):
    """Schema for creating a user. Frontend now sends first_name + last_name.

    `full_name` is computed from the two for backwards compatibility with the
    existing User model. `username` is auto-derived from email if not supplied
    so the registration form only needs to collect first/last/email/phone/password.
    """

    password: str = Field(..., min_length=5, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    phone: str = Field(
        ..., min_length=10, max_length=20, description="Phone number is required"
    )
    role: UserRole = UserRole.customer
    verification_method: VerificationMethod = VerificationMethod.otp_email

    @computed_field
    @property
    def full_name(self) -> str:
        return f"{self.first_name.strip()} {self.last_name.strip()}".strip()

    @validator("phone")
    def validate_phone(cls, v):
        """Validate phone number format."""
        phone_digits = "".join(filter(str.isdigit, v))
        if len(phone_digits) == 10 and phone_digits[0] in "6789":
            return v
        if 10 <= len(phone_digits) <= 15:
            return v
        raise ValueError(
            "Invalid phone number format. Please enter a valid phone number."
        )

    @model_validator(mode="after")
    def derive_username(self):
        """Auto-derive username from email if not provided (frontend-friendly)."""
        if not self.username and self.email:
            base = self.email.split("@")[0]
            base = "".join(c for c in base if c.isalnum() or c in "._-")[:50] or "user"
            self.username = base
        return self


class UserResponse(UserBase):
    """Schema for user response, including nested profile."""

    id: int
    role: UserRole
    is_active: bool
    email_verified: bool
    phone_verified: bool = False
    signup_verification_method: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    profile: Optional[UserProfileResponse] = None

    class Config:
        from_attributes = True


class RegisterResponse(BaseModel):
    """Response after registration when OTP verification is required."""

    message: str
    user_id: int
    email: str
    phone: Optional[str] = None
    verification_method: str
    otp_expires_in: int = 600
    requires_verification: bool = True


# ==================== Token Schemas ====================


class Token(BaseModel):
    """Schema for token response."""

    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int


class TokenRefresh(BaseModel):
    """Schema for token refresh request."""

    refresh_token: str


# ==================== Login Schemas ====================


class LoginRequest(BaseModel):
    """Schema for login request."""

    identifier: str = Field(..., description="Username, email, or phone number")
    password: Optional[str] = None
    remember_me: bool = False
    login_method: Optional[str] = None
    otp_code: Optional[str] = None
    otp_type: Optional[str] = None


class LoginResponse(BaseModel):
    """Schema for login response."""

    user: UserResponse
    tokens: Token
    session_id: str


# ==================== Password Schemas ====================


class ChangePasswordRequest(BaseModel):
    """Schema for changing password."""

    current_password: str
    new_password: str = Field(..., min_length=5)


class ForgotPasswordRequest(BaseModel):
    """Schema for requesting password reset."""

    identifier: str = Field(..., description="Email address or phone number")
    otp_type: str = Field(default="SMS", description="EMAIL or SMS")


class PasswordResetRequest(BaseModel):
    """Schema for requesting password reset (alias)."""

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema for confirming password reset."""

    token: str
    new_password: str = Field(..., min_length=5)


class ResetPasswordWithOtpRequest(BaseModel):
    """Schema for resetting password with OTP verification."""

    identifier: str = Field(..., description="Email or phone number")
    otp_code: str = Field(
        ..., min_length=6, max_length=6, description="6-digit OTP code"
    )
    new_password: str = Field(..., min_length=5, description="5-character password")
    otp_type: str = Field(default="SMS", description="EMAIL or SMS")


class VerifyResetOtpRequest(BaseModel):
    """Schema for verifying OTP before password reset (Fix #1)."""

    identifier: str = Field(..., description="Email or phone number")
    otp_code: str = Field(
        ..., min_length=6, max_length=6, description="6-digit OTP code"
    )
    otp_type: str = Field(default="SMS", description="EMAIL or SMS")


class VerifyResetOtpResponse(BaseModel):
    """Schema for OTP verification response (Fix #1)."""

    success: bool
    message: str
    verified: bool
    identifier: Optional[str] = None
    error_code: Optional[str] = None


class LoginOtpRequest(BaseModel):
    """Schema for requesting login OTP."""

    identifier: str = Field(..., description="Email, username, or phone number")
    otp_type: str = Field(default="EMAIL", description="EMAIL, SMS, or WHATSAPP")


class LoginOtpVerify(BaseModel):
    """Schema for verifying login OTP."""

    identifier: str = Field(..., description="Email, username, or phone number")
    otp_code: str = Field(
        ..., min_length=6, max_length=6, description="6-digit OTP code"
    )
    login_method: str = Field(default="otp", description="otp")
    otp_type: str = Field(default="EMAIL", description="EMAIL, SMS, or WHATSAPP")
    remember_me: bool = False
