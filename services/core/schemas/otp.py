"""OTP schemas for email and WhatsApp verification."""
from pydantic import BaseModel, field_validator
from typing import Optional
from enum import Enum


class OTPType(str, Enum):
    """OTP delivery method."""
    EMAIL = "EMAIL"
    WHATSAPP = "WHATSAPP"


class OTPSendRequest(BaseModel):
    """Request to send OTP."""
    email: Optional[str] = None
    phone: Optional[str] = None
    otp_type: OTPType = OTPType.EMAIL
    purpose: str = "verification"
    
    @field_validator('email')
    @classmethod
    def validate_email_required(cls, v, info):
        """Validate email is provided when OTP type is EMAIL."""
        if info.data.get('otp_type') == OTPType.EMAIL and not v:
            raise ValueError("Email is required for EMAIL OTP")
        return v
    
    @field_validator('phone')
    @classmethod
    def validate_phone_required(cls, v, info):
        """Validate phone is provided when OTP type is WHATSAPP."""
        if info.data.get('otp_type') == OTPType.WHATSAPP and not v:
            raise ValueError("Phone number is required for WHATSAPP OTP")
        return v


class OTPVerifyRequest(BaseModel):
    """Request to verify OTP."""
    email: Optional[str] = None
    phone: Optional[str] = None
    otp_code: str
    otp_type: OTPType = OTPType.EMAIL
    purpose: str = "verification"
    
    @field_validator('otp_code')
    @classmethod
    def validate_otp_code(cls, v):
        """Validate OTP code is 6 digits."""
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP code must be 6 digits")
        return v


class OTPResendRequest(BaseModel):
    """Request to resend OTP."""
    email: Optional[str] = None
    phone: Optional[str] = None
    otp_type: OTPType = OTPType.EMAIL
    purpose: str = "verification"
    
    @field_validator('email')
    @classmethod
    def validate_email_required(cls, v, info):
        """Validate email is provided when OTP type is EMAIL."""
        if info.data.get('otp_type') == OTPType.EMAIL and not v:
            raise ValueError("Email is required for EMAIL OTP")
        return v
    
    @field_validator('phone')
    @classmethod
    def validate_phone_required(cls, v, info):
        """Validate phone is provided when OTP type is WHATSAPP."""
        if info.data.get('otp_type') == OTPType.WHATSAPP and not v:
            raise ValueError("Phone number is required for WHATSAPP OTP")
        return v


class OTPSendResponse(BaseModel):
    """Response after sending OTP."""
    success: bool
    message: str
    expires_in: int
    email: Optional[str] = None
    phone: Optional[str] = None
    otp_type: Optional[str] = None


class OTPVerifyResponse(BaseModel):
    """Response after verifying OTP."""
    success: bool
    message: str
    verified: bool
