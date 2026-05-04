"""Core platform service package — exposes the canonical auth + OTP services."""

from service.auth_service import AuthService, AuthServiceOTP
from service.otp_service import OTPService
from service.sms_service import SMSService

__all__ = ["AuthService", "AuthServiceOTP", "OTPService", "SMSService"]
