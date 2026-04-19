"""Core Platform Service - Aarya Clothing"""
from service.auth_service_otp import AuthServiceOTP as AuthService
from service.otp_service import OTPService

__all__ = ["AuthService", "OTPService"]
